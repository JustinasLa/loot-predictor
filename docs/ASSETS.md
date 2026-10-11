# Game artwork and item names

Eatventure and its game artwork belong to **Lessmore GmbH** and their respective rights holders. This is an unofficial community tool, with no affiliation with or endorsement by the game developer. The game artwork is not covered by a license to this project's original code, and no ownership or redistribution permission is asserted here.

## Original artwork

The item and chest illustrations in `public/assets/items/` are actual Eatventure game images, obtained from the community [1vcian/ev reference implementation](https://github.com/1vcian/ev). This is also the reference credited by the predictor's existing loot tables. No generated or generic replacement artwork is presented as game art.

The imported snapshot is pinned to commit [`f427d12473f3d78f10be7450cfc95ab35703fd44`](https://github.com/1vcian/ev/tree/f427d12473f3d78f10be7450cfc95ab35703fd44/src), retrieved on 2026-10-11. Each original image is `src/<game-asset-id>.png` in that snapshot. For example, the Laser Gun comes from [`src/Tool_LaserGun.png`](https://github.com/1vcian/ev/blob/f427d12473f3d78f10be7450cfc95ab35703fd44/src/Tool_LaserGun.png).

The local files use lossless WebP compression. The original resolution, transparency, and every visible RGBA pixel are preserved; RGB values in fully transparent pixels may change during compression. This reduces the 153 images from 8,944,069 bytes to 3,210,454 bytes. There are no runtime image requests to the source repository or other third parties.

[`public/assets/items/manifest.json`](../public/assets/items/manifest.json) records the exact original download URL, original PNG SHA-256, local WebP SHA-256, dimensions, and byte count for every image. The upstream filenames are retained, apart from the file extension.

Coverage includes all **138 unique item IDs** in `ITEM_POOLS`, plus pet food and both adventure vault keys. The remaining images provide box and adventure selectors and the common Chicken pet. Five egg illustrations are shared by item results and egg selectors. Images are resolved through a fixed allowlist in [`src/ui/presentation.js`](../src/ui/presentation.js); unknown IDs receive a readable text label without a fabricated image or external URL.

All 153 original sprites were visually reviewed after alpha compositing onto an opaque background. Reviewers should preserve transparency when inspecting these files: RGB color values in fully transparent pixels can look like horizontal streaks in viewers that discard the alpha channel, but those pixels are invisible in the actual interface. Do not replace these clean, high-resolution sprites based on such a preview. Final compressed files were also compared with their originals for matching dimensions, alpha, and visible pixels.

The reference repository has no separate artwork license. Its README invites community continuation of the predictor, but that statement does not grant rights to the game's artwork. Preserve this attribution and the manifest when redistributing these assets. Developer attribution is corroborated by the [Eatventure App Store listing](https://apps.apple.com/us/app/eatventure/id1600871388).

## Display names

Friendly English names were checked against the [Eatventure Tools equipment catalog](https://eatventuretools.app/equipment/browse), its [pet guide](https://eatventuretools.app/guides/pets), and the [Eatventure Wiki clothing list](https://eatventure.fandom.com/wiki/Clothing). Where internal IDs are misleading, the exact upstream game image was visually checked against the named catalog item. The catalog is a community resource by pb30; its footer states it is unaffiliated with Eatventure. Names are factual item labels, not copied descriptions or statistics.

Some intentionally preserved internal IDs differ substantially from their displayed names:

| Internal ID | Display name |
| --- | --- |
| `Hat_Leperchaun` | Irish Hat |
| `Hat_Round` | White Hat |
| `Hat_Barista` | Green Cap |
| `Body_Kimono_Black` | Kimono White Belt |
| `Body_Kimono_Blue` | Kimono Black Belt |
| `Hat_WarriorHelmet` | Chef's Helmet |
| `Body_WarriorApron` | Armoured Apron |
| `Tool_FlourSpoon` | Scooper |
| `Pet_Roomba` | Vroomba |
| `Necklace_Lai` | Lei |
| `Necklace_Shelfish` | Shellfish |
| `Ring_Sea` | Ring of Seas |

`Body_ToolBelt` occurs in both the Legendary pool and the Ultimate Mine pool in the inherited prediction data. It remains Tool Belt in both places, and the actual predicted rarity remains separate. The presentation layer does not change item IDs, rarity, loot tables, or random-number behavior. Head and body Shark items are labeled “Shark Head” and “Shark Body” to make their equipment slots unambiguous.
