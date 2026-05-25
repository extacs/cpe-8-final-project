function initMap(mapData) {
    // 0 (empty Global Arrays)
    boundaries.length = 0
    mapPortals.length = 0
    characters.length = 0

    // 1 (Initializers)
    player.position = {
        x: canvas.width / 2 - 192 / 4 / 2,
        y: canvas.height / 2 - 68 / 2}
    player.image = playerDownImage

    offset = mapData.spawnPoint

    background.image = mapImage
    background.position = {
        x: offset.x,
        y: offset.y
    }
    foreground.image = foregroundImage
    foreground.position = {
        x: offset.x,
        y: offset.y
    }
        
    // 2 (loading map logics)
    // mapping from "data/triggerZone.js"
    const mapPortalZoneMap = []
    for (let i = 0; i < mapData.mapPortalZoneData.length; i += mapTileWidth) {
        mapPortalZoneMap.push(mapData.mapPortalZoneData.slice(i, mapTileWidth + i))
    }

    // mapping from "data/collisions.js"
    const collisionsMap = []
    for (let i = 0; i < mapData.collisions.length; i += mapTileWidth) {
        collisionsMap.push(mapData.collisions.slice(i, mapTileWidth + i))
    }

    // mapping from "data/characters.js"
    const charactersMap = []
    for (let i = 0; i < mapData.charactersMapData.length; i += mapTileWidth) {
        charactersMap.push(mapData.charactersMapData.slice(i, mapTileWidth + i))
    }

    // mapLoader
    mapImage.src = mapData.background
    foregroundImage.src = mapData.foreground
    
    // Update NPC images if they exist in this map
    if (mapData.villagerSrc) villagerImg.src = mapData.villagerSrc
    if (mapData.oldmanSrc) oldManImg.src = mapData.oldmanSrc

    // 3 (map logic init)
    // COLLISIONS mapping (based on data/collisions.js)
    collisionsMap.forEach((row, i) => {
        row.forEach((symbol, j) => {
            if (symbol === 1025) {
                boundaries.push(new Boundary({
                    position: {
                        x: j * Boundary.width + offset.x,
                        y: i * Boundary.height + offset.y
                    }
                }))
            }
        })
    })

    // MAP PORTAL ZONE mapping (based on data/mapPortalZone.js)
    mapPortalZoneMap.forEach((row, i) => {
        row.forEach((symbol, j) => {
            if (symbol === 45826) {
                mapPortals.push(new Boundary({
                    position: {
                        x: j * Boundary.width + offset.x,
                        y: i * Boundary.height + offset.y
                    }
                }))
            }
        })
    })

    // 4 (char-map loader)
    // Character sprite initializer
    charactersMap.forEach((row, i) => {
        row.forEach((symbol, j) => {
            // 1026 === villager
            if (symbol === 1026) {
            characters.push(
                new Character({
                position: {
                    x: j * Boundary.width + offset.x,
                    y: i * Boundary.height + offset.y
                },
                image: villagerImg,
                frames: {
                    max: 4,
                    hold: 60
                },
                scale: 3,
                animate: true,
                dialogue: ['...', 'Hey mister, have you seen my Doggochu?']
                })
            )
            }
            // 1031 === oldMan
            else if (symbol === 1031) {
                characters.push(
                    new Character({
                    position: {
                        x: j * Boundary.width + offset.x,
                        y: i * Boundary.height + offset.y
                    },
                    image: oldManImg,
                    frames: {
                        max: 4,
                        hold: 60
                    },
                    scale: 3,
                    dialogue: ['My bones hurt.']
                    })
                )
            }

            if (symbol !== 0) {
                boundaries.push(
                    new Boundary({
                    position: {
                        x: j * Boundary.width + offset.x,
                        y: i * Boundary.height + offset.y
                    }
                    })
                )
            }
        })
    })
    
    // 5 (recalculate movables/renderables)
    movables.length = 0 // reset movables[]
    renderables.length = 0 // reset renderables[]
    movables.push(
        background, 
        ...boundaries, 
        ...mapPortals, 
        foreground, 
        ...characters
    )
    renderables.push(
        background,
        ...boundaries,
        ...mapPortals,
        ...characters,
        player,
        foreground
    )
}