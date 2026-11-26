# Iron Basin

Iron Basin is a single-player, modern-setting real-time strategy game played on an isometric battlefield. In **Foothold**, the player starts with Command HQ, an operating metal mine, one battle tank, 420 metal, and no oil. Establish a refinery, deliver oil, and destroy the northern outpost. Losing HQ ends the mission.

## Construction and production

Open **Build** from anywhere on the map. The opening objective is a refinery so the player can start earning metal. Place facilities on the highlighted construction grid in the clearings around HQ. Each footprint snaps to whole tiles. Roads, water, occupied tiles, deposits, loading areas, and units constrain placement. Metal mines and oil wells go directly on their matching deposits.

Construction spends the cost and reserves the site immediately. Scaffolding and a percentage show progress. Extraction, the refinery’s free hauler, and unit production become available when construction finishes. Timers use game time and stop when paused.

| Building | Metal | Build time | Placement and purpose |
| --- | ---: | ---: | --- |
| Refinery | 150 | 10 s | 3 × 2 tiles. Receives both resources. Each completed refinery supplies one hauler. |
| Barracks | 110 | 8 s | 3 × 2 tiles. Trains infantry. |
| Vehicle factory | 190 | 14 s | 3 × 3 tiles. Builds haulers and battle tanks. |
| Metal mine | 140 | 7 s | Metal deposit. Extracts 4.2 metal per second. |
| Oil well | 160 | 8 s | Oil field. Extracts 3.2 oil per second. |

Select a completed producer to use its queue. Each barracks or factory processes one unit at a time and can hold five orders, including the active order. Separate buildings can produce concurrently.

| Unit | Producer | Metal | Oil | Production time |
| --- | --- | ---: | ---: | ---: |
| Infantry | Barracks | 45 | 0 | 4 s |
| Hauler | Vehicle factory | 85 | 0 | 4 s |
| Battle tank | Vehicle factory | 180 | 55 | 8 s |

## Resource deliveries

Each extractor holds up to 160 units. One truck loads at a time. A hauler takes up to 35 units after a 1.7-second loading interval and drives to its refinery. Resources enter the player’s stockpile on delivery.

Haulers automatically choose an operating extractor. To dedicate a truck to metal or oil, select it and right-click the mine or well, or use **Assign route**. A loaded truck delivers its existing cargo before starting a newly assigned route.

## Orders and camera

- Click a unit to select it, Shift-click to add units, or drag a box around a group. Double-click a friendly unit or building to select friendly mobile units within five world tiles.
- **Move (M)** followed by a ground click sends units to their destination. **Attack Move (A)** engages enemies encountered on the way and resumes the route after combat. Right-click an enemy for a focused attack.
- Right-click terrain with a building selected to set its rally. A flag shows the point. New units leave their producer and head to its rally point. HQ supplies a default for facilities without their own. Haulers resume collection after rallying. Extractor rallies can act as waypoints for loaded trucks.
- Pan with arrow keys, middle-drag, Alt-drag, touch drag, or the tactical map. Scroll or use the zoom buttons to zoom. H centers HQ and Space pauses.
- The tactical map uses the battlefield’s isometric projection for terrain, units, structures, the viewport outline, and click-to-center.
- On touchscreens, tap a destination to give an order. For grid construction, tap once to preview a footprint and tap it again to build.

## Hosting

GitHub Pages serves the static game from the root of the repository’s main branch. The game uses HTML, CSS, JavaScript, and the Canvas API. It runs locally by serving the same files over HTTP.

[Play Iron Basin](https://bishoppawn1.github.io/RTS/)
