// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {DeployPons} from "../script/DeployPons.s.sol";
import {RobinShareVaultFactory} from "../src/RobinShareVaultFactory.sol";
import {RobinShareVault} from "../src/RobinShareVault.sol";
import {PonsAddresses} from "../src/pons/PonsAddresses.sol";

/// @title El script de deploy, testeado — porque un cableado mal puesto NO se puede arreglar
/// @notice `feeEscrow`, `ponsFactory` y `xVerifier` son INMUTABLES en la factory, y el vault los
///         copia a sus propios inmutables al crearse. Un error de tipeo en cualquiera de las
///         cinco direcciones no se corrige con una transaccion: hay que redeployar y abandonar
///         todos los vaults ya creados. Por eso el script se testea antes de correrlo, y por eso
///         las direcciones viven en `PonsAddresses` y no en el argumento de un comando.
contract DeployPonsTest is Test {
    DeployPons script;
    address attester = makeAddr("attester");
    address attesterAdmin = makeAddr("attester-admin");

    function setUp() public {
        script = new DeployPons();
    }

    function test_deploy_cableaLasDireccionesCanonicas() public {
        RobinShareVaultFactory f = script.deploy(attester, attesterAdmin);

        assertEq(f.attester(), attester, "attester");
        assertEq(f.attesterAdmin(), attesterAdmin, "attesterAdmin");
        assertEq(f.feeEscrow(), PonsAddresses.FEE_ESCROW, "feeEscrow");
        assertEq(f.ponsFactory(), PonsAddresses.LAUNCH_FACTORY, "ponsFactory");
        assertEq(f.xVerifier(), PonsAddresses.X_GENERAL_VERIFIER, "xVerifier");
    }

    /// @notice El cableado tiene que llegar hasta el VAULT, no quedarse en la factory.
    /// @dev Es la unica forma de cazar una factory que compila y despliega bien pero produce
    ///      vaults que apuntan al escrow equivocado — o sea, vaults que nunca podran cobrar.
    function test_deploy_losVaultsHeredanElRail() public {
        RobinShareVaultFactory f = script.deploy(attester, attesterAdmin);
        RobinShareVault v = RobinShareVault(payable(f.createVault(1, "torvalds", address(0), 0)));

        assertEq(address(v.feeEscrow()), PonsAddresses.FEE_ESCROW, "el vault cobra del escrow real");
        assertEq(address(v.ponsFactory()), PonsAddresses.LAUNCH_FACTORY, "verifica contra pons real");
        assertEq(v.attesterSource(), address(f), "el attester se lee EN VIVO de la factory");
        assertEq(v.attester(), attester);
    }

    /// @notice Un vault de X hereda el verifier; uno de GitHub no lo necesita.
    function test_deploy_vaultDeXHeredaElVerifier() public {
        RobinShareVaultFactory f = script.deploy(attester, attesterAdmin);
        RobinShareVault x = RobinShareVault(payable(f.createVault(2, "0xkeezy", address(0), 0)));
        assertEq(x.xVerifier(), PonsAddresses.X_GENERAL_VERIFIER);
    }

    /// @notice `attesterAdmin = 0` es una eleccion valida (desactiva el co-gate), no un error.
    /// @dev Es una de las decisiones que quedan abiertas para Jose en PENDIENTES.md: con 0 nadie
    ///      puede rotar el attester salvo el attester mismo, asi que una llave perdida congela
    ///      para siempre el ETH de todos los vaults de GitHub.
    function test_deploy_aceptaAttesterAdminCero() public {
        RobinShareVaultFactory f = script.deploy(attester, address(0));
        assertEq(f.attesterAdmin(), address(0));
    }

    /// @notice El guard de cadena: el script no puede correr fuera de Robinhood Chain.
    function test_run_rechazaOtraCadena() public {
        vm.chainId(1);
        vm.expectRevert(bytes("wrong chain (expected 4663)"));
        script.run();
    }

    /// @notice Los args del constructor que van a `forge verify-contract`, calculados por el mismo
    ///         script — para que el runbook no dependa de copiar cinco direcciones a mano.
    function test_constructorArgs_matcheaElConstructorReal() public view {
        bytes memory args = script.constructorArgs(attester, attesterAdmin);
        assertEq(
            args,
            abi.encode(
                attester,
                PonsAddresses.FEE_ESCROW,
                PonsAddresses.LAUNCH_FACTORY,
                PonsAddresses.X_GENERAL_VERIFIER,
                attesterAdmin
            )
        );
    }
}
