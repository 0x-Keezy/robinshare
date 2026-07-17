// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {SocialFeeEscrowFactory} from "../src/SocialFeeEscrowFactory.sol";
import {SocialFeeEscrowDeployer} from "../src/SocialFeeEscrowDeployer.sol";
import {SocialFeeEscrow} from "../src/SocialFeeEscrow.sol";
import {VaultUISchema, VaultMethodSchema} from "../src/flap/IVaultSchemasV1.sol";
import {IXGeneralVerifier} from "../src/flap/IXGeneralVerifier.sol";

/// Test del UNICO finding del audit v4 de GT (reporte 774664f8, 2026-07-17, High):
/// `vaultUISchema()` declaraba `claimByProof` y `recoverUnclaimed` con CERO inputs, pero las
/// firmas reales tomaban `claimByProof(XGeneralProof,bytes)` (2 params, uno un struct) y
/// `recoverUnclaimed(address)` (1 param) — un UI generico que siguiera el schema encodeaba el
/// selector equivocado y la ruta X + la recovery del creator quedaban inejecutables desde el
/// portal. Fix: se aplano `claimByProof` a 5 params escalares (declarables en el vocabulario de
/// `FieldDescriptor.fieldType`, que no tiene "tuple"/"struct") y el schema ahora declara los
/// inputs REALES de ambos metodos. Ver el docblock de `SocialFeeEscrow.claimByProof` y
/// AUDIT-NOTES.md para el detalle completo, incluyendo el deployer split que liberó el espacio
/// de bytecode necesario para declarar los 5 inputs sin volver a acercarse al cap de EIP-170.
contract AuditFixesV4Test is Test {
    address creator = makeAddr("creator");
    address attesterAddr = makeAddr("attester");
    address predictedToken = address(0x7777);

    function setUp() public {
        vm.chainId(4663);
    }

    function attester() external view returns (address) {
        return attesterAddr;
    }

    function _newTwitter(address verifier) internal returns (SocialFeeEscrow) {
        return new SocialFeeEscrow(predictedToken, creator, 2, "0xkeezy", address(0), address(0), verifier, 0);
    }

    function _newGithub(uint64 recoveryAfter) internal returns (SocialFeeEscrow) {
        return new SocialFeeEscrow(
            predictedToken, creator, 1, "torvalds", address(0), address(this), address(0), recoveryAfter
        );
    }

    // ───────────────────────── Schema: inputs REALES de claimByProof y recoverUnclaimed ─────────────────────────

    function test_schema_claimByProof_declara5InputsConFieldTypesExactos() public {
        SocialFeeEscrow e = _newTwitter(makeAddr("v"));
        VaultUISchema memory s = e.vaultUISchema();
        VaultMethodSchema memory m = s.methods[1];
        assertEq(m.name, "claimByProof");
        assertTrue(m.isWriteMethod);
        assertEq(m.inputs.length, 5, "claimByProof debe declarar sus 5 params reales");
        assertEq(m.inputs[0].name, "tweetId");
        assertEq(m.inputs[0].fieldType, "uint256");
        assertEq(m.inputs[1].name, "xHandle");
        assertEq(m.inputs[1].fieldType, "string");
        assertEq(m.inputs[2].name, "xId");
        assertEq(m.inputs[2].fieldType, "uint256");
        assertEq(m.inputs[3].name, "substring");
        assertEq(m.inputs[3].fieldType, "string");
        assertEq(m.inputs[4].name, "signature");
        assertEq(m.inputs[4].fieldType, "bytes");
    }

    function test_schema_recoverUnclaimed_declara1InputAddress() public {
        SocialFeeEscrow e = _newGithub(0);
        VaultUISchema memory s = e.vaultUISchema();
        VaultMethodSchema memory m = s.methods[4];
        assertEq(m.name, "recoverUnclaimed");
        assertTrue(m.isWriteMethod);
        assertEq(m.inputs.length, 1, "recoverUnclaimed debe declarar su unico param real");
        assertEq(m.inputs[0].name, "to");
        assertEq(m.inputs[0].fieldType, "address");
    }

    /// El corazon de la prueba: para CADA write method del schema, el selector que un UI
    /// generico calcularia a partir de los fieldTypes declarados debe coincidir con el selector
    /// REAL de la funcion (obtenido del compilador via `.selector`, no re-tipeado a mano). Esto
    /// es lo que estaba roto para claimByProof/recoverUnclaimed antes del fix, y lo que un futuro
    /// cambio de firma sin actualizar el schema volveria a romper.
    function test_schema_selectorMatchesRealFunction_paraTodosLosWriteMethods() public {
        SocialFeeEscrow e = _newTwitter(makeAddr("v"));
        VaultUISchema memory s = e.vaultUISchema();
        uint256 checked;
        for (uint256 i = 0; i < s.methods.length; i++) {
            VaultMethodSchema memory m = s.methods[i];
            if (!m.isWriteMethod) continue;
            bytes4 computed = _computedSelector(m);
            bytes4 real = _realSelector(e, m.name);
            assertEq(computed, real, string.concat("selector mismatch para ", m.name));
            checked++;
        }
        assertEq(checked, 5, "deberian haberse chequeado los 5 write methods (claimAndBind, claimByProof, rebindWallet, sweep, recoverUnclaimed)");
    }

    function _abiType(string memory fieldType) internal pure returns (string memory) {
        // "time" es alias de uint256 para efectos de ABI encoding (IVaultSchemasV1.sol).
        if (keccak256(bytes(fieldType)) == keccak256(bytes("time"))) return "uint256";
        return fieldType;
    }

    function _computedSelector(VaultMethodSchema memory m) internal pure returns (bytes4) {
        string memory sig = string.concat(m.name, "(");
        for (uint256 i = 0; i < m.inputs.length; i++) {
            if (i > 0) sig = string.concat(sig, ",");
            sig = string.concat(sig, _abiType(m.inputs[i].fieldType));
        }
        sig = string.concat(sig, ")");
        return bytes4(keccak256(bytes(sig)));
    }

    function _realSelector(SocialFeeEscrow e, string memory name) internal pure returns (bytes4) {
        bytes32 h = keccak256(bytes(name));
        if (h == keccak256(bytes("claimAndBind"))) return e.claimAndBind.selector;
        if (h == keccak256(bytes("claimByProof"))) return e.claimByProof.selector;
        if (h == keccak256(bytes("rebindWallet"))) return e.rebindWallet.selector;
        if (h == keccak256(bytes("sweep"))) return e.sweep.selector;
        if (h == keccak256(bytes("recoverUnclaimed"))) return e.recoverUnclaimed.selector;
        revert("unknown method in schema -- add it to _realSelector");
    }

    // ───────────────────────── claimByProof: firma plana end-to-end ─────────────────────────

    function test_claimByProof_firmaPlana_endToEnd() public {
        MockXVerifierV4 v = new MockXVerifierV4();
        SocialFeeEscrow e = _newTwitter(address(v));
        (bool ok,) = address(e).call{value: 1.5 ether}("");
        assertTrue(ok);
        address payout = makeAddr("keezy-wallet");
        string memory substring = e.expectedTweet(payout);

        vm.prank(payout);
        e.claimByProof(4242, "0xkeezy", 99, substring, hex"aa");

        assertEq(e.boundWallet(), payout);
        assertEq(payout.balance, 1.5 ether);
        assertEq(e.pendingAmount(), 0);
        assertEq(e.lastTweetId(), 4242);
    }

    function test_claimByProof_tweetIdOverflow_reverts() public {
        MockXVerifierV4 v = new MockXVerifierV4();
        SocialFeeEscrow e = _newTwitter(address(v));
        address payout = makeAddr("p");
        string memory substring = e.expectedTweet(payout);
        uint256 tooBig = uint256(type(uint128).max) + 1;
        vm.prank(payout);
        vm.expectRevert(bytes(unicode"tweetId too large / tweetId 过大"));
        e.claimByProof(tooBig, "0xkeezy", 1, substring, hex"aa");
    }

    function test_claimByProof_xIdOverflow_reverts() public {
        MockXVerifierV4 v = new MockXVerifierV4();
        SocialFeeEscrow e = _newTwitter(address(v));
        address payout = makeAddr("p");
        string memory substring = e.expectedTweet(payout);
        uint256 tooBig = uint256(type(uint128).max) + 1;
        vm.prank(payout);
        vm.expectRevert(bytes(unicode"xId too large / xId 过大"));
        e.claimByProof(1, "0xkeezy", tooBig, substring, hex"aa");
    }

    function test_claimByProof_tweetIdEnElLimite_ok() public {
        // type(uint128).max EXACTO debe pasar el bounds check (limite inclusivo).
        MockXVerifierV4 v = new MockXVerifierV4();
        SocialFeeEscrow e = _newTwitter(address(v));
        address payout = makeAddr("p");
        string memory substring = e.expectedTweet(payout);
        vm.prank(payout);
        e.claimByProof(uint256(type(uint128).max), "0xkeezy", 1, substring, hex"aa");
        assertEq(e.lastTweetId(), type(uint128).max);
    }

    // ───────────────────────── SocialFeeEscrowDeployer: gate y tamaños ─────────────────────────

    function test_deployer_soloLaFactoryQueLoCreoPuedeLlamarDeploy() public {
        SocialFeeEscrowFactory f = new SocialFeeEscrowFactory(attesterAddr);
        SocialFeeEscrowDeployer d = f.deployer();
        vm.prank(makeAddr("random-caller"));
        vm.expectRevert(bytes(unicode"only factory / 仅限工厂"));
        d.deploy(predictedToken, creator, 1, "torvalds", address(0), address(this), address(0), 0);
    }

    function test_deployer_capturaSuFactoryComoInmutable() public {
        SocialFeeEscrowFactory f = new SocialFeeEscrowFactory(attesterAddr);
        assertEq(f.deployer().factory(), address(f));
    }

    function test_deployer_dosFactoriesTienenDeployersDistintos() public {
        SocialFeeEscrowFactory f1 = new SocialFeeEscrowFactory(attesterAddr);
        SocialFeeEscrowFactory f2 = new SocialFeeEscrowFactory(makeAddr("otro-attester"));
        SocialFeeEscrowDeployer d1 = f1.deployer();
        assertTrue(address(d1) != address(f2.deployer()));
        // el deployer de f1 sigue gateado a f1, no a f2. NOTA: resolver `d1` ANTES de prankear --
        // `f1.deployer().deploy(...)` en una sola expresion son DOS calls externos (el getter y
        // deploy); vm.prank solo cubre el call INMEDIATO siguiente, asi que consumirlo en el
        // getter dejaria a deploy() corriendo con el msg.sender real del test (falso negativo).
        vm.prank(address(f2));
        vm.expectRevert(bytes(unicode"only factory / 仅限工厂"));
        d1.deploy(predictedToken, creator, 1, "torvalds", address(0), address(this), address(0), 0);
    }

    /// El flujo real de newVault (via portal, gateado) sigue funcionando de punta a punta
    /// pasando por el deployer -- no solo el gate del deployer en aislamiento.
    function test_newVault_viaDeployer_creaUnVaultFuncional() public {
        SocialFeeEscrowFactory f = new SocialFeeEscrowFactory(attesterAddr);
        address portal = f.vaultPortal();
        vm.prank(portal);
        address vaultAddr =
            f.newVault(predictedToken, address(0), creator, abi.encode("github", "torvalds", address(0), uint256(0)));
        assertTrue(vaultAddr != address(0));
        SocialFeeEscrow v = SocialFeeEscrow(payable(vaultAddr));
        assertEq(v.creator(), creator);
        assertEq(v.taxToken(), predictedToken);
    }
}

contract MockXVerifierV4 is IXGeneralVerifier {
    function verify(IXGeneralVerifier.XGeneralProof calldata, bytes calldata) external pure returns (bool) {
        return true;
    }

    function oracleKey() external pure returns (address) {
        return address(0);
    }
}
