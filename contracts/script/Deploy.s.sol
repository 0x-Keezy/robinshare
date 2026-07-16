// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {SocialFeeEscrowFactory} from "../src/SocialFeeEscrowFactory.sol";
import {RobinhoodAddresses} from "../src/flap/RobinhoodAddresses.sol";

/// forge script script/Deploy.s.sol --rpc-url robinhood --broadcast --private-key $DEPLOYER_PK
contract Deploy is Script {
    function run() external {
        require(block.chainid == RobinhoodAddresses.CHAIN_ID, "wrong chain (expected 4663)");
        // Attester CANONICO de la factory (wallet dedicada del oraculo FLEDGE). Env obligatoria.
        address attester = vm.envAddress("ATTESTER_ADDRESS");
        require(attester != address(0), "set ATTESTER_ADDRESS");
        vm.startBroadcast();
        SocialFeeEscrowFactory factory = new SocialFeeEscrowFactory(attester);
        vm.stopBroadcast();
        console2.log("SocialFeeEscrowFactory:", address(factory));
        console2.log("VaultPortal:", factory.vaultPortal());
        console2.log("Canonical attester:", factory.attester());
    }
}
