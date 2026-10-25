# @konitif/scene

Headless descriptions and evaluation for scene environments, day-cycle curves and articulated models. Workbench composes these resources; UI and renderers project them.

The package provides normalization of legacy environment data, interpolation and tangents, UTC celestial directions, lighting projections and a declarative articulated-model profile. It owns no camera, renderer, animation clock, robot connection or engine runtime. Applications select assets, providers and physical simulation explicitly.

The existing serialized environment and curve forms remain valid. UI and product compatibility names may re-export these contracts without retaining a second evaluator.
