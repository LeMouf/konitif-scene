# Release procedure

The public package owns scene environment data, curve evaluation and articulated model descriptions. It excludes product profiles, assets, UI, renderers, engines and clocks.

Run npm ci --ignore-scripts, npm run build, npm test and npm run verify:package. The exact archive is qualified in an isolated Node ESM and strict NodeNext consumer.

Merge the reviewed change into main before creating the exact version tag. The publication workflow remains disabled until the package has its npm trusted publisher configured for LeMouf/konitif-scene, publish.yml, environment npm-release. First publication requires an admitted npm maintainer session; no token is stored in this repository. Protected workflow qualification and exact tag ancestry are required for subsequent publication.

The initial 0.1.0 archive was published through an explicitly authorized maintainer session to establish the package. This one-time bootstrap has no CI provenance. Version 0.1.1 verifies the protected OIDC workflow after trust configuration; future releases use that workflow.
