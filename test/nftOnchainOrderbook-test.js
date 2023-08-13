const { expect } = require("chai");

describe("ERC721Marketplace", function() {
    let ERC721Mock, erc721, ERC721Marketplace, marketplace, owner, alice, bob, carol;

    beforeEach(async function() {
        // Deploy ERC721 token contract (mock for testing)
        ERC721Mock = await ethers.getContractFactory("ERC721Mock");
        erc721 = await ERC721Mock.deploy("TestToken", "TST");

        // Deploy ERC721Marketplace
        ERC721Marketplace = await ethers.getContractFactory("nftOnchainOrderbook");
        marketplace = await ERC721Marketplace.deploy();

        [owner, alice, bob, carol] = await ethers.getSigners();

        // Mint test tokens
        await erc721.mint(alice.address, 1);
        await erc721.mint(bob.address, 2);
    });

    describe("Listing a Token", function() {
        it("Should allow a user to list their token", async function() {
            await erc721.connect(alice).approve(marketplace.address, 1);
            await marketplace.connect(alice).listToken(erc721.address, 1, ethers.utils.parseEther("1"));
            const order = await marketplace.orders(1);
            expect(order.tokenAddress).to.equal(erc721.address);
            expect(order.tokenId).to.equal(1);
            expect(order.price).to.equal(ethers.utils.parseEther("1"));
            expect(order.seller).to.equal(alice.address);
            expect(order.isActive).to.equal(true);
        });

        it("Shouldn't allow a user to list a token they don't own", async function() {
            await expect(marketplace.connect(bob).listToken(erc721.address, 1, ethers.utils.parseEther("1")))
                .to.be.revertedWith("Not owner of the token");
        });

        it("Shouldn't allow a token to be listed twice", async function() {
            await erc721.connect(alice).approve(marketplace.address, 1);
            await marketplace.connect(alice).listToken(erc721.address, 1, ethers.utils.parseEther("1"));
            await expect(marketplace.connect(alice).listToken(erc721.address, 1, ethers.utils.parseEther("2")))
                .to.be.revertedWith("Token already listed");
        });
    });

    describe("Cancelling a Listing", function() {
        beforeEach(async function() {
            await erc721.connect(alice).approve(marketplace.address, 1);
            await marketplace.connect(alice).listToken(erc721.address, 1, ethers.utils.parseEther("1"));
        });

        it("Should allow the seller to cancel a listing", async function() {
            await marketplace.connect(alice).cancelListing(1);
            const order = await marketplace.orders(1);
            expect(order.isActive).to.equal(false);
        });

        it("Shouldn't allow someone else to cancel a listing", async function() {
            await expect(marketplace.connect(bob).cancelListing(1))
                .to.be.revertedWith("Not the seller");
        });
    });

    describe("Buying a Token", function() {
        beforeEach(async function() {
            await erc721.connect(alice).approve(marketplace.address, 1);
            await marketplace.connect(alice).listToken(erc721.address, 1, ethers.utils.parseEther("1"));
        });

        it("Should allow a user to buy a listed token", async function() {
            await marketplace.connect(carol).buyToken(1, { value: ethers.utils.parseEther("1") });
            expect(await erc721.ownerOf(1)).to.equal(carol.address);
        });

        it("Should transfer the funds to the seller's pending withdrawals", async function() {
            await marketplace.connect(carol).buyToken(1, { value: ethers.utils.parseEther("1") });
            expect(await marketplace.pendingWithdrawals(alice.address)).to.equal(ethers.utils.parseEther("1"));
        });

        it("Shouldn't allow a user to buy a token with insufficient funds", async function() {
            await expect(marketplace.connect(carol).buyToken(1, { value: ethers.utils.parseEther("0.5") }))
                .to.be.revertedWith("Incorrect Ether sent");
        });
    });

    describe("Withdrawal", function() {
        beforeEach(async function() {
            await erc721.connect(alice).approve(marketplace.address, 1);
            await marketplace.connect(alice).listToken(erc721.address, 1, ethers.utils.parseEther("1"));
            await marketplace.connect(carol).buyToken(1, { value: ethers.utils.parseEther("1") });
        });

        it("Should allow a seller to withdraw their funds", async function() {
            const beforeBalance = await alice.getBalance();
            await marketplace.connect(alice).withdraw();
            const afterBalance = await alice.getBalance();
            expect(afterBalance.sub(beforeBalance)).to.equal(ethers.utils.parseEther("1"));
        });

        it("Should reset the seller's pending withdrawals after withdrawal", async function() {
            await marketplace.connect(alice).withdraw();
            expect(await marketplace.pendingWithdrawals(alice.address)).to.equal(0);
        });

        it("Shouldn't allow withdrawal if there are no funds", async function() {
            await expect(marketplace.connect(bob).withdraw())
                .to.be.revertedWith("No funds to withdraw");
        });
    });
});
