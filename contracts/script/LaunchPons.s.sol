// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {RobinShareVault} from "../src/RobinShareVault.sol";
import {RobinShareVaultFactory} from "../src/RobinShareVaultFactory.sol";
import {PonsAddresses} from "../src/pons/PonsAddresses.sol";
import {
    IPonsV2Launchpad,
    IPonsV2Curve,
    IPonsV2LaunchFactory,
    PonsSocials,
    PonsTokenParams
} from "../src/pons/IPonsV2.sol";

/// @title LaunchPons — las TRES transacciones del launch, en un solo comando
///
/// @notice Reemplaza la Opcion B del runbook (tres `cast send` a mano). No es comodidad: el
///         launch es la UNICA transaccion irreversible del producto, y el comando escrito a mano
///         ya fallo DOS veces por comillas del shell — una en el review y otra corriendolo de
///         verdad contra un fork. Un `cast send` que no parsea es barato; uno que parsea MAL y
///         manda 0,0005 ETH con los campos corridos, no.
///
///         Aca los parametros son tipados, el orden lo pone el compilador, y todo lo que se puede
///         chequear se chequea ANTES de gastar un wei.
///
/// @dev USO — primero SIN --broadcast (simula y no manda nada):
///
///   export FACTORY=0x...            # la RobinShareVaultFactory ya deployada
///   export NAME="RobinShare Pilot"
///   export SYMBOL=RSHARE
///   export IDENTITY_TYPE=1          # 0 wallet · 1 github · 2 x
///   export IDENTITY_VALUE=0x-keezy  # vacio si es wallet
///   export IDENTITY_WALLET=0x0000000000000000000000000000000000000000
///   export RECOVERY_DAYS=0          # 0 = nunca (el default del producto)
///   export CREATOR_TAX_BPS=1000     # 10,00%
///   export LOGO=https://github.com/0x-keezy.png
///   export DESCRIPTION="fees routed to a builder"
///
///   forge script script/LaunchPons.s.sol --rpc-url robinhood --compute-units-per-second 40
///   # y recien despues, con --broadcast --private-key $DEPLOYER_PK
contract LaunchPons is Script {
    function run() external {
        require(block.chainid == PonsAddresses.CHAIN_ID, "wrong chain (expected 4663)");

        // Modo verify-only: no lanza nada, solo verifica un launch que YA ocurrio, contra la
        // cadena real. Es la contraparte honesta del `_verify` de la simulacion.
        address vv = vm.envOr("VERIFY_VAULT", address(0));
        if (vv != address(0)) {
            address vt = vm.envAddress("VERIFY_TOKEN");
            RobinShareVault vc = RobinShareVault(payable(vv));
            _verify(vv, vt, vc.curve(), vc.recoveryAfter() == 0 ? 0 : 30, _taxOf(vt));
            return;
        }

        RobinShareVaultFactory factory = RobinShareVaultFactory(vm.envAddress("FACTORY"));
        IPonsV2Launchpad pons = IPonsV2Launchpad(PonsAddresses.LAUNCH_FACTORY);

        // Los rangos se validan ANTES del cast. `uint16(vm.envUint(...))` trunca en SILENCIO:
        // `CREATOR_TAX_BPS=66036` pasaba como 500 (5%, no 10%) y el launch quedaba con la mitad
        // del take del creador para siempre, con el checklist post-launch en verde.
        uint256 rawType = vm.envUint("IDENTITY_TYPE");
        require(rawType <= 2, "IDENTITY_TYPE tiene que ser 0, 1 o 2");
        uint256 rawTax = vm.envUint("CREATOR_TAX_BPS");
        require(rawTax <= type(uint16).max, "CREATOR_TAX_BPS fuera de rango");

        uint8 identityType = uint8(rawType);
        string memory identityValue = vm.envOr("IDENTITY_VALUE", string(""));
        address identityWallet = vm.envOr("IDENTITY_WALLET", address(0));
        uint256 recoveryDays = vm.envOr("RECOVERY_DAYS", uint256(0));
        uint16 creatorTaxBps = uint16(rawTax);
        string memory name = vm.envString("NAME");
        string memory symbol = vm.envString("SYMBOL");

        _preflight(factory, pons, identityType, identityValue, identityWallet, creatorTaxBps, recoveryDays);

        uint256 fee = pons.launchFee();
        // El pin de la economia se lee JUSTO antes de lanzar: si el owner de pons re-pegara los
        // terminos entre esta lectura y el envio, el launch revierte en vez de aterrizar bajo
        // otras reglas.
        bytes32 economics =
            pons.previewLaunchEconomics(PonsAddresses.LAUNCH_CONFIG_ID, address(0));

        vm.startBroadcast();

        // ── 1/3 · el vault va PRIMERO ───────────────────────────────────────────
        // La creation code de la curva de pons incluye el `creatorFeeRecipient`, asi que la
        // direccion del token depende de la del vault: el orden no es negociable.
        address vault = factory.createVault(identityType, identityValue, identityWallet, recoveryDays);
        console2.log("1/3  vault:", vault);

        // ── 2/3 · el launch ─────────────────────────────────────────────────────
        PonsTokenParams memory p;
        p.name = name;
        p.symbol = symbol;
        p.logo = vm.envOr("LOGO", string(""));
        p.description = vm.envOr("DESCRIPTION", string(""));
        // Socials. La via "recomendada" lanzaba el token MAS PELADO de las tres —sin website,
        // sin twitter— mientras la opcion a mano del runbook si mandaba el github del dev. Para
        // una moneda cuyo pitch es "las fees van a este builder", la pagina de pons sin un solo
        // link es un defecto de producto, y `TokenParams` se congela en el launch.
        string memory website = vm.envOr("WEBSITE", string(""));
        if (bytes(website).length == 0 && identityType == 1 && bytes(identityValue).length > 0) {
            website = string.concat("https://github.com/", identityValue);
        }
        string memory twitter = vm.envOr("TWITTER", string(""));
        if (bytes(twitter).length == 0 && identityType == 2 && bytes(identityValue).length > 0) {
            twitter = string.concat("https://x.com/", identityValue);
        }
        p.socials = PonsSocials(twitter, vm.envOr("TELEGRAM", string("")), "", website, "");
        p.creatorFeeRecipient = vault;
        p.creatorTaxBps = creatorTaxBps;
        p.buybackEnabled = false; // NUNCA true: `attachToken` lo rechaza y el launch quedaria huerfano
        p.expectedEconomics = economics;
        // Salt: pons lo namespacea por cuenta, asi que solo tiene que ser un valor que esta
        // wallet no haya usado. No hay vanity que minar.
        p.salt = keccak256(abi.encode(vault, block.timestamp, name, symbol));

        (address token, address curve) =
            pons.launchToken{value: fee}(p, PonsAddresses.LAUNCH_CONFIG_ID, address(0));
        console2.log("2/3  token:", token);
        console2.log("     curve:", curve);

        // ── 3/3 · atar vault <-> token ──────────────────────────────────────────
        RobinShareVault(payable(vault)).attachToken(token);
        console2.log("3/3  atado");

        vm.stopBroadcast();

        _verify(vault, token, curve, recoveryDays, creatorTaxBps);
    }

    /// @dev El creatorTaxBps que quedo registrado, para que el modo verify-only se compare
    ///      contra la cadena y no contra un env que puede haber cambiado.
    function _taxOf(address token) internal view returns (uint16) {
        return IPonsV2LaunchFactory(PonsAddresses.LAUNCH_FACTORY).getLaunchedToken(token).creatorTaxBps;
    }

    /// @dev Todo lo que se puede saber ANTES de gastar. Cada `require` de aca es un launch que no
    ///      se hizo mal.
    function _preflight(
        RobinShareVaultFactory factory,
        IPonsV2Launchpad pons,
        uint8 identityType,
        string memory identityValue,
        address identityWallet,
        uint16 creatorTaxBps,
        uint256 recoveryDays
    ) internal view {
        console2.log("--- preflight ---");

        require(address(factory).code.length > 0, "FACTORY no tiene codigo en esta red");

        // El try/catch no es decorativo: apuntar FACTORY a la direccion equivocada (la de pons,
        // por ejemplo) es un error plausible el dia del launch, y sin esto el script moria con un
        // "EvmError: Revert" pelado que no dice nada. Se niega igual — pero ahora se entiende.
        address att;
        try factory.attester() returns (address a) {
            att = a;
        } catch {
            revert("FACTORY no responde attester(): no es una RobinShareVaultFactory");
        }
        require(att != address(0), "la factory no tiene attester");
        console2.log("  factory:        ", address(factory));
        console2.log("  attester:       ", att);
        require(
            factory.feeEscrow() == PonsAddresses.FEE_ESCROW
                && factory.ponsFactory() == PonsAddresses.LAUNCH_FACTORY,
            "la factory apunta a OTRO rail: no es la del launch de pons"
        );

        // ¿YA HAY UN VAULT PARA ESTA IDENTIDAD?
        //
        // `createVault` no deduplica (es el producto: cualquiera puede crear vaults para
        // cualquiera), y el salt incluye el vault fresco, asi que dos corridas identicas lanzan
        // DOS monedas con el mismo nombre y ticker, sin una sola advertencia. El disparador
        // realista es el que el runbook documenta: el RPC devuelve HTML de Cloudflare mientras
        // forge espera un recibo, el operador ve un error y reintenta. Ahora hay dos $RSHARE
        // "para 0x-keezy", la liquidez partida, y hay que explicar publicamente cual es la buena.
        bytes32 idHash = factory.identityHashFor(identityType, identityValue, identityWallet);
        uint256 existing = factory.getVaults(idHash).length;
        if (existing > 0) {
            console2.log("  !! YA EXISTEN", existing, "vault(s) para esta identidad:");
            address[] memory vs = factory.getVaults(idHash);
            for (uint256 i = 0; i < vs.length; i++) console2.log("     ", vs[i]);
            require(
                vm.envOr("ALLOW_SECOND_VAULT", false),
                "Ya hay un vault para esta identidad. Si el launch anterior fallo a mitad de camino, revisalo antes de lanzar otra moneda. Para lanzar igual: ALLOW_SECOND_VAULT=true"
            );
            console2.log("  (ALLOW_SECOND_VAULT=true - sigo igual)");
        }

        require(pons.launchEnabled(), "pons tiene el launch publico CERRADO ahora mismo");
        require(creatorTaxBps <= pons.maxCreatorTaxBps(), "CREATOR_TAX_BPS por encima del tope de pons");
        require(
            recoveryDays == 0 || (recoveryDays >= 30 && recoveryDays <= 3650),
            "RECOVERY_DAYS: 0 (nunca) o entre 30 y 3650"
        );

        console2.log("  launchFee:      ", pons.launchFee());
        console2.log("  maxCreatorTax:  ", pons.maxCreatorTaxBps());
        console2.log("  creatorTaxBps:  ", creatorTaxBps);
        console2.log("  recoveryDays:   ", recoveryDays);
        if (recoveryDays != 0) {
            console2.log("  !! con recovery > 0 el launcher puede recuperar el saldo si nadie");
            console2.log("     prueba la identidad. Verifica que el handle EXISTA de verdad.");
        }
        console2.log("-----------------");
    }

    /// @dev Los chequeos post-launch que el runbook pedia hacer a mano, en el mismo comando.
    ///
    ///      ⚠️ OJO CON LO QUE ESTO ES Y NO ES. En `forge script`, `run()` corre UNA vez en el EVM
    ///      de simulacion; `vm.startBroadcast()` solo GRABA las llamadas para mandarlas despues.
    ///      O sea que esto verifica el estado SIMULADO, y se imprime ANTES de que exista la
    ///      primera transaccion real. La simulacion corre contra estado fresco de la cadena y
    ///      forge aborta el broadcast entero si `run()` revierte, asi que cubre casi todo — pero
    ///      NO cubre una divergencia entre la simulacion y la inclusion (ej: el owner de pons
    ///      re-pega la fee en el medio). Foundry no tiene hook post-broadcast.
    ///
    ///      Para verificar contra la cadena DE VERDAD, despues del broadcast:
    ///        VERIFY_VAULT=0x... VERIFY_TOKEN=0x... forge script script/LaunchPons.s.sol --rpc-url robinhood
    function _verify(
        address vault,
        address token,
        address curve,
        uint256 recoveryDays,
        uint16 creatorTaxBps
    ) internal view {
        console2.log("--- verificacion post-launch ---");

        IPonsV2LaunchFactory.LaunchedToken memory info =
            IPonsV2LaunchFactory(PonsAddresses.LAUNCH_FACTORY).getLaunchedToken(token);

        require(info.exists, "pons no registro el launch");
        require(info.creatorFeeRecipient == vault, "las fees NO apuntan al vault");
        require(info.pairToken == address(0), "el launch quedo pareado contra un ERC-20");
        require(!info.buybackEnabled, "el buyback quedo prendido");
        // El unico parametro economico que eligio el operador, y no se verificaba: un
        // `CREATOR_TAX_BPS` truncado dejaba el launch con la mitad del take y todo en verde.
        require(info.creatorTaxBps == creatorTaxBps, "el creatorTaxBps registrado NO es el que pediste");

        // El que de verdad importa: si la curva no reconoce al vault, `sweepCurve()` revierte
        // para siempre y las fees quedan fuera de alcance.
        require(IPonsV2Curve(curve).deployer() == vault, "la curva NO autoriza al vault a barrer");

        RobinShareVault v = RobinShareVault(payable(vault));
        require(v.token() == token, "el vault no quedo atado al token");
        require(v.curve() == curve, "el vault no quedo atado a la curva");
        require((recoveryDays == 0) == (v.recoveryAfter() == 0), "recoveryAfter no coincide");
        console2.log("  recoveryAfter:  ", v.recoveryAfter());

        // La identidad NORMALIZADA, que es la que va a tener que probar el builder. `_normalize`
        // strippea el `@` y baja a minusculas: si quedo distinta de lo que el operador creia,
        // este es el unico lugar donde se ve antes de compartir el link.
        console2.log("  identidad:      ", v.identityValue());
        console2.log("  creatorTaxBps:  ", info.creatorTaxBps);
        console2.log("  fees -> vault:   OK");
        console2.log("  par nativo:      OK");
        console2.log("  buyback off:     OK");
        console2.log("  curva autoriza:  OK");
        console2.log("  vault atado:     OK");
        console2.log("");
        console2.log("LISTO. La pagina de claim del builder:");
        console2.log("  /claim/%s", vm.toString(vault));
        console2.log("recoveryAfter:", v.recoveryAfter());
    }
}
