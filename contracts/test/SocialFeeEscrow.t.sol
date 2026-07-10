// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {SocialFeeEscrow} from "../src/SocialFeeEscrow.sol";
import {VaultUISchema} from "../src/flap/IVaultSchemasV1.sol";

/// Helper que fuerza el stipend de 2300 gas (semántica de transfer())
contract StipendSender {
    function send(address payable to) external payable {
        to.transfer(msg.value); // revierte si el receptor gasta >2300 gas
    }
}

contract SocialFeeEscrowTest is Test {
    // anvil key #0 — attester de los tests
    uint256 constant ATTESTER_PK = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
    address attester;
    address taxToken = address(0x7A11); // dirección predicha, sin código (a propósito)
    address creator = address(0xC0FFEE);

    function setUp() public {
        attester = vm.addr(ATTESTER_PK);
    }

    function _newGithub(uint64 recoveryAfter) internal returns (SocialFeeEscrow) {
        return new SocialFeeEscrow(taxToken, creator, 1, "torvalds", address(0), attester, recoveryAfter);
    }

    // ───────────────────────── Task 2: constructor + receive() ─────────────────────────

    function test_constructor_github_setsFields() public {
        SocialFeeEscrow e = _newGithub(0);
        assertEq(e.taxToken(), taxToken);
        assertEq(e.creator(), creator);
        assertEq(e.identityType(), 1);
        assertEq(e.identityValue(), "torvalds");
        assertEq(e.attester(), attester);
        assertEq(e.recoveryAfter(), 0);
        assertEq(e.boundWallet(), address(0));
        assertEq(e.bindNonce(), 0);
        assertEq(e.totalPaid(), 0);
    }

    function test_constructor_wallet_bindsImmediately() public {
        address person = address(0xBEEF);
        SocialFeeEscrow e = new SocialFeeEscrow(taxToken, creator, 0, "", person, address(0), 0);
        assertEq(e.boundWallet(), person);
        assertEq(e.identityType(), 0);
    }

    function test_constructor_wallet_zeroWallet_reverts() public {
        vm.expectRevert();
        new SocialFeeEscrow(taxToken, creator, 0, "", address(0), address(0), 0);
    }

    function test_constructor_social_zeroAttester_reverts() public {
        vm.expectRevert();
        new SocialFeeEscrow(taxToken, creator, 1, "torvalds", address(0), address(0), 0);
    }

    function test_constructor_badType_reverts() public {
        vm.expectRevert();
        new SocialFeeEscrow(taxToken, creator, 3, "x", address(0), attester, 0);
    }

    /// INVARIANTE DURA: receive() nunca revierte, ni con stipend 2300.
    function test_receive_acceptsPlainCall() public {
        SocialFeeEscrow e = _newGithub(0);
        (bool ok,) = address(e).call{value: 1 ether}("");
        assertTrue(ok);
        assertEq(address(e).balance, 1 ether);
    }

    function test_receive_acceptsWith2300Stipend() public {
        SocialFeeEscrow e = _newGithub(0);
        StipendSender s = new StipendSender();
        s.send{value: 0.5 ether}(payable(address(e))); // transfer() = 2300 gas
        assertEq(address(e).balance, 0.5 ether);
    }

    function testFuzz_receive_neverReverts(uint96 amount) public {
        SocialFeeEscrow e = _newGithub(0);
        vm.deal(address(this), amount);
        (bool ok,) = address(e).call{value: amount}("");
        assertTrue(ok);
    }
}
