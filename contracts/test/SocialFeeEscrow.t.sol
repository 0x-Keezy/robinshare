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

    function _sign(SocialFeeEscrow e, address payout, uint256 deadline) internal view returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(ATTESTER_PK, e.bindDigest(payout, deadline));
        return abi.encodePacked(r, s, v);
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

    // ───────────────────────── Task 3: bindDigest + claimAndBind ─────────────────────────

    function test_claimAndBind_paysAndBinds() public {
        SocialFeeEscrow e = _newGithub(0);
        (bool ok,) = address(e).call{value: 2 ether}("");
        assertTrue(ok);
        address payout = makeAddr("torvalds-wallet");
        uint256 deadline = block.timestamp + 15 minutes;

        vm.expectEmit(true, false, false, true, address(e));
        emit SocialFeeEscrow.Bound(payout, 0);
        e.claimAndBind(payout, deadline, _sign(e, payout, deadline));

        assertEq(e.boundWallet(), payout);
        assertEq(e.bindNonce(), 1);
        assertEq(payout.balance, 2 ether);
        assertEq(address(e).balance, 0);
        assertEq(e.totalPaid(), 2 ether);
    }

    function test_claimAndBind_zeroBalance_bindsWithoutPaying() public {
        SocialFeeEscrow e = _newGithub(0);
        address payout = makeAddr("early-bird");
        uint256 deadline = block.timestamp + 15 minutes;
        e.claimAndBind(payout, deadline, _sign(e, payout, deadline)); // no revierte
        assertEq(e.boundWallet(), payout);
        assertEq(e.totalPaid(), 0);
    }

    function test_pendingAmount_tracksBalance() public {
        SocialFeeEscrow e = _newGithub(0);
        assertEq(e.pendingAmount(), 0);
        (bool ok,) = address(e).call{value: 3 ether}("");
        assertTrue(ok);
        assertEq(e.pendingAmount(), 3 ether);
    }

    // ───────────────────────── Task 4: matriz adversarial + re-bind ─────────────────────────

    function test_claim_wrongSigner_reverts() public {
        SocialFeeEscrow e = _newGithub(0);
        uint256 deadline = block.timestamp + 15 minutes;
        address payout = makeAddr("p");
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(0xBAD, e.bindDigest(payout, deadline)); // otra key
        vm.expectRevert(bytes(unicode"bad attester signature / 认证签名无效"));
        e.claimAndBind(payout, deadline, abi.encodePacked(r, s, v));
    }

    function test_claim_expired_reverts() public {
        SocialFeeEscrow e = _newGithub(0);
        uint256 deadline = block.timestamp + 1;
        address payout = makeAddr("p");
        bytes memory sig = _sign(e, payout, deadline);
        vm.warp(deadline + 1);
        vm.expectRevert(bytes(unicode"voucher expired / 凭证已过期"));
        e.claimAndBind(payout, deadline, sig);
    }

    function test_claim_replay_reverts() public {
        SocialFeeEscrow e = _newGithub(0);
        address payout = makeAddr("p");
        uint256 deadline = block.timestamp + 15 minutes;
        bytes memory sig = _sign(e, payout, deadline);
        e.claimAndBind(payout, deadline, sig);
        // mismo voucher otra vez: el nonce ya avanzo -> digest distinto -> firma invalida
        vm.expectRevert(bytes(unicode"bad attester signature / 认证签名无效"));
        e.claimAndBind(payout, deadline, sig);
    }

    function test_claim_voucherDeOtroVault_reverts() public {
        SocialFeeEscrow e1 = _newGithub(0);
        SocialFeeEscrow e2 = _newGithub(0);
        address payout = makeAddr("p");
        uint256 deadline = block.timestamp + 15 minutes;
        bytes memory sigParaE1 = _sign(e1, payout, deadline);
        vm.expectRevert(bytes(unicode"bad attester signature / 认证签名无效"));
        e2.claimAndBind(payout, deadline, sigParaE1); // verifyingContract distinto
    }

    function test_claim_zeroPayout_reverts() public {
        SocialFeeEscrow e = _newGithub(0);
        uint256 deadline = block.timestamp + 15 minutes;
        vm.expectRevert(bytes(unicode"zero payout / 收款地址为空"));
        e.claimAndBind(address(0), deadline, hex"00");
    }

    function test_claim_onWalletType_reverts() public {
        SocialFeeEscrow e = new SocialFeeEscrow(taxToken, creator, 0, "", makeAddr("w"), address(0), 0);
        vm.expectRevert(bytes(unicode"wallet identity: use sweep / 钱包身份请用 sweep"));
        e.claimAndBind(makeAddr("p"), block.timestamp + 1, hex"00");
    }

    function test_rebind_conVoucherFresco() public {
        SocialFeeEscrow e = _newGithub(0);
        address w1 = makeAddr("w1");
        address w2 = makeAddr("w2");
        uint256 deadline = block.timestamp + 15 minutes;
        e.claimAndBind(w1, deadline, _sign(e, w1, deadline)); // nonce 0 -> 1
        (bool ok,) = address(e).call{value: 1 ether}("");
        assertTrue(ok);
        e.claimAndBind(w2, deadline, _sign(e, w2, deadline)); // _sign lee bindNonce()=1
        assertEq(e.boundWallet(), w2);
        assertEq(w2.balance, 1 ether);
    }
}
