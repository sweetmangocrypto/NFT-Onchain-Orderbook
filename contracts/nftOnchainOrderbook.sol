// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract nftOnchainOrderbook is ReentrancyGuard {
    struct Order {
        address tokenAddress;
        uint256 tokenId;
        address seller;
        uint256 price;
        bool isActive;
    }

    mapping(uint256 => Order) public orders;
    uint256 public nextOrderId = 1;

    mapping(address => mapping(uint256 => bool)) public listedTokens;

    mapping(address => uint256) public pendingWithdrawals;

    event OrderCreated(
        uint256 indexed orderId,
        address indexed tokenAddress,
        uint256 indexed tokenId,
        address seller,
        uint256 price
    );

    event OrderCancelled(
        uint256 indexed orderId,
        address indexed tokenAddress,
        uint256 indexed tokenId
    );

    event TokenPurchased(
        uint256 indexed orderId,
        address indexed tokenAddress,
        uint256 indexed tokenId,
        address buyer
    );

    function listToken(address _tokenAddress, uint256 _tokenId, uint256 _price) external {
        require(IERC721(_tokenAddress).ownerOf(_tokenId) == msg.sender, "Not owner of the token");
        require(!listedTokens[_tokenAddress][_tokenId], "Token already listed");
        require(IERC721(_tokenAddress).getApproved(_tokenId) == address(this), "Marketplace not approved to transfer this token");

        orders[nextOrderId] = Order({
            tokenAddress: _tokenAddress,
            tokenId: _tokenId,
            seller: msg.sender,
            price: _price,
            isActive: true
        });

        listedTokens[_tokenAddress][_tokenId] = true;

        emit OrderCreated(nextOrderId, _tokenAddress, _tokenId, msg.sender, _price);

        nextOrderId++;
    }

    function cancelListing(uint256 _orderId) external {
        Order storage order = orders[_orderId];
        require(order.isActive, "Order not active");
        require(msg.sender == order.seller, "Not the seller");

        IERC721(order.tokenAddress).approve(order.seller, order.tokenId);
        listedTokens[order.tokenAddress][order.tokenId] = false;

        order.isActive = false;

        emit OrderCancelled(_orderId, order.tokenAddress, order.tokenId);
    }

    function buyToken(uint256 _orderId) external payable nonReentrant {
        Order storage order = orders[_orderId];
        require(order.isActive, "Order not active");
        require(msg.value == order.price, "Incorrect Ether sent");

        IERC721(order.tokenAddress).transferFrom(address(this), msg.sender, order.tokenId);
        listedTokens[order.tokenAddress][order.tokenId] = false;

        pendingWithdrawals[order.seller] += order.price;

        order.isActive = false;

        emit TokenPurchased(_orderId, order.tokenAddress, order.tokenId, msg.sender);
    }

    function withdraw() external {
        uint256 amount = pendingWithdrawals[msg.sender];
        require(amount > 0, "No funds to withdraw");

        pendingWithdrawals[msg.sender] = 0;

        payable(msg.sender).transfer(amount);
    }

    function totalOrders() external view returns (uint256) {
        return nextOrderId - 1;
    }
}
