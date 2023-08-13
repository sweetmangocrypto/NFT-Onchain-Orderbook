// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract ERC721Mock is ERC721Enumerable, Ownable {
    constructor(string memory name, string memory symbol) ERC721(name, symbol) {}

    /**
     * @dev Mint new tokens. Only the owner can mint tokens.
     * This is for testing purposes.
     *
     * @param to The address that will own the minted token.
     * @param tokenId The token ID to mint.
     */
    function mint(address to, uint256 tokenId) external onlyOwner {
        _mint(to, tokenId);
    }
}
