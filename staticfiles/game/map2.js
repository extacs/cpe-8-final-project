
function map2() {
    const canvas = document.querySelector('#map2_canvas')
    const c = canvas.getContext('2d')

    canvas.width = 1260
    canvas.height = 700
    currentMap 

    // based on Tiled's map sizing i created
    mapTileWidth = 70
    mapTileHeight = 40

    // battlezonesMap
    // --removed

    // mapping from "data/map1_mapPortalZone.js"
    const mapPortalZoneMap = []
    for (let i = 0; i < mapPortalZoneData.length; i += mapTileWidth) {
        mapPortalZoneMap.push(mapPortalZoneData.slice(i, mapTileWidth + i))
    }

    // mapping from "data/collisions.js"
    const collisionsMap = []
    for (let i = 0; i < collisions.length; i += mapTileWidth) {
        collisionsMap.push(collisions.slice(i, mapTileWidth + i))
    }

    // mapping from "data/characters.js"
    const charactersMap = []
    for (let i = 0; i < charactersMapData.length; i += mapTileWidth) {
        charactersMap.push(charactersMapData.slice(i, mapTileWidth + i))
    }

    // mapping from "data/spawnZones.js"
    const mainSpawnZoneMap = []
    for (let i = 0; i < mainSpawnZoneData.length; i += mapTileWidth) {
        mainSpawnZoneMap.push(mainSpawnZoneData.slice(i, mapTileWidth + i))
    }
    console.log(mainSpawnZoneMap)


    const boundaries = []
    const mapPortals = [] // map_portal zone for changing maps 
    const mainSpawnZone = [] // main spawnzone (will add more spawn zones for different map soon)
    const offset = { // spawn/initial offset (it is also where the will focus/center)
        x: -858, // -858 orig val
        y: -550 // -550 orig val
    }

    // COLLISIONS mapping (based on data/collisions.js)
    collisionsMap.forEach((row, i) => {
        row.forEach((symbol, j) => {
            if (symbol === 1025)
            boundaries.push(
                new Boundary({
                position: {
                    x: j * Boundary.width + offset.x,
                    y: i * Boundary.height + offset.y
                }
                })
            )
        })
    })


    // TRIGGERZONE mapping (based on data/map1/mapPortalZone.js)
    // mapPortalZoneMap.forEach((row, i) => {
    //     row.forEach((symbol, j) => {
    //         if (symbol === 45826)
    //         mapPortals.push(
    //             new Boundary({
    //             position: {
    //                 x: j * Boundary.width + offset.x,
    //                 y: i * Boundary.height + offset.y
    //             }
    //             })
    //         )
    //     })
    // })



    // list for characters
    const characters = []
    const villagerImg = new Image()
    villagerImg.src = './img/villager/Idle.png'

    const oldManImg = new Image()
    oldManImg.src = './img/oldMan/Idle.png'

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

    // Tiles resources loading
    const mapImage = new Image()
    mapImage.src = './img/map2/Pellet Town.png'

    const foregroundImage = new Image()
    foregroundImage.src = './img/map2/foregroundObjects.png'

    const playerDownImage = new Image()
    playerDownImage.src = './img/playerDown.png'

    const playerUpImage = new Image()
    playerUpImage.src = './img/playerUp.png'

    const playerLeftImage = new Image()
    playerLeftImage.src = './img/playerLeft.png'

    const playerRightImage = new Image()
    playerRightImage.src = './img/playerRight.png'

    // Player initializer 
    const player = new Sprite({
        position: {
            x: canvas.width / 2 - 192 / 4 / 2,
            y: canvas.height / 2 - 68 / 2
        },
        image: playerDownImage,
        frames: {
            max: 4,
            hold: 10
        },
        sprites: {
            up: playerUpImage,
            left: playerLeftImage,
            right: playerRightImage,
            down: playerDownImage
        }
    })

    const background = new Sprite({
        position: {
            x: offset.x,
            y: offset.y
        },
        image: mapImage
    })

    const foreground = new Sprite({
        position: {
            x: offset.x,
            y: offset.y
        },
        image: foregroundImage
    })

    const keys = {
        w: {
            pressed: false
        },
        a: {
            pressed: false
        },
        s: {
            pressed: false
        },
        d: {
            pressed: false
        }
    }

    const movables = [
        background,
        ...boundaries,
        ...mapPortals,
        foreground,
        ...characters
    ]
    const renderables = [
        background,
        ...boundaries,
        ...mapPortals,
        ...characters,
        player,
        foreground
    ]

    // main entry point or start of the game
    function animate() {
        const animationId = window.requestAnimationFrame(animate)

        renderables.forEach((renderable) => {
            renderable.draw()
        })

        let moving = true
        player.animate = false

        // <------------- MAP PORTAL system end ------------->
        // if (keys.w.pressed || keys.a.pressed || keys.s.pressed || keys.d.pressed) {
        //     for (let i = 0; i < mapPortals.length; i++) {
        //         const mapPortal = mapPortals[i]
        //         const overlappingArea =
        //             (Math.min(
        //             player.position.x + player.width,
        //             mapPortal.position.x + mapPortal.width
        //             ) -
        //             Math.max(player.position.x, mapPortal.position.x)) *
        //             (Math.min(
        //             player.position.y + player.height,
        //             mapPortal.position.y + mapPortal.height
        //             ) -
        //             Math.max(player.position.y, mapPortal.position.y))
        //         // colliding = true, then do this:
        //         if (
        //             rectangularMapPortal({
        //                 rectangle1: player,
        //                 rectangle2: mapPortal
        //             }) && overlappingArea > (player.width * player.height) / 2
        //         ) {
        //             console.log("Im getting tp'd.")
        //             // deactivate current animation loop
        //             window.cancelAnimationFrame(animationId)

        //             audio.Map.stop()
        //             break
        //         }
        //     }
        // }
        // <------------- MAP PORTAL system end ------------->


        // <------------- Movement system start ------------->
        playerSpeed = 4;
        // -- W -- Up Movement 
        if (keys.w.pressed && lastKey === 'w') {
            player.animate = true
            player.image = player.sprites.up

            // <------------ COLLISION SYSTEM start ------------> 
            checkForCharacterCollision({
                characters,
                player,
                characterOffset: { x: 0, y: 10 }
            })
            for (let i = 0; i < boundaries.length; i++) {
                const boundary = boundaries[i]
                // colliding = true, then do this:
                if (
                    rectangularCollision({
                        rectangle1: player,
                        rectangle2: {
                            ...boundary,
                            position: {
                            x: boundary.position.x,
                            y: boundary.position.y + playerSpeed 
                            }
                        }
                    })
                ) {

                    moving = false
                    break
                }
            }
            // <------------ COLLISION SYSTEM end ------------> 

            if (moving)
            movables.forEach((movable) => {
                movable.position.y += playerSpeed // increase for speed
            })

        // -- A -- Left Movement 
        } else if (keys.a.pressed && lastKey === 'a') {
            player.animate = true
            player.image = player.sprites.left

            // <------------ COLLISION SYSTEM start ------------>
            checkForCharacterCollision({
                characters,
                player,
                characterOffset: { x: 10, y: 0 }
            })

            for (let i = 0; i < boundaries.length; i++) {
                const boundary = boundaries[i]
                if (
                    rectangularCollision({
                        rectangle1: player,
                        rectangle2: {
                            ...boundary,
                            position: {
                            x: boundary.position.x + playerSpeed,
                            y: boundary.position.y
                            }
                        }
                    })
                ) {
                    moving = false
                    break
                }
            }
            // <------------ COLLISION SYSTEM end ------------> 

            if (moving)
            movables.forEach((movable) => {
                movable.position.x += playerSpeed
            })

        // -- S -- Down Movement 
        } else if (keys.s.pressed && lastKey === 's') {
            player.animate = true
            player.image = player.sprites.down

            // <------------ COLLISION SYSTEM start ------------>
            checkForCharacterCollision({
                characters,
                player,
                characterOffset: { x: 0, y: -10 }
            })

            for (let i = 0; i < boundaries.length; i++) {
                const boundary = boundaries[i]
                if (
                    rectangularCollision({
                        rectangle1: player,
                        rectangle2: {
                            ...boundary,
                            position: {
                            x: boundary.position.x,
                            y: boundary.position.y - playerSpeed
                            }
                        }
                    })
                ) {
                    moving = false
                    break
                }
            }
            // <------------ COLLISION SYSTEM end ------------> 

            if (moving)
            movables.forEach((movable) => {
                movable.position.y -= playerSpeed
            })

        // -- D -- RightMovement 
        } else if (keys.d.pressed && lastKey === 'd') {
            player.animate = true
            player.image = player.sprites.right

            // <------------ COLLISION SYSTEM start ------------> 
            checkForCharacterCollision({
                characters,
                player,
                characterOffset: { x: -10, y: 0 }
            })

            for (let i = 0; i < boundaries.length; i++) {
                const boundary = boundaries[i]
                if (
                    rectangularCollision({
                        rectangle1: player,
                        rectangle2: {
                            ...boundary,
                            position: {
                            x: boundary.position.x - playerSpeed,
                            y: boundary.position.y
                            }
                        }
                    })
                ) {
                    console.log("Im getting collided.")
                    moving = false
                    break
                }
            }
            // <------------ COLLISION SYSTEM end ------------> 

            if (moving)
                movables.forEach((movable) => {
                    movable.position.x -= playerSpeed
                })
        }
        // <------------- Movement system end ------------->
    }

    animate()

    // Interaction system (currently not working)
    let lastKey = ''
    window.addEventListener('keydown', (e) => {
        if (player.isInteracting) {
            switch (e.key) {
            case ' ':
                player.interactionAsset.dialogueIndex++

                const { dialogueIndex, dialogue } = player.interactionAsset
                if (dialogueIndex <= dialogue.length - 1) {
                document.querySelector('#characterDialogueBox').innerHTML =
                    player.interactionAsset.dialogue[dialogueIndex]
                return
                }

                // finish conversation
                player.isInteracting = false
                player.interactionAsset.dialogueIndex = 0
                document.querySelector('#characterDialogueBox').style.display = 'none'

                break
            }
            return
        }

        switch (e.key) {
            case ' ':
            if (!player.interactionAsset) return

            // beginning the conversation
            const firstMessage = player.interactionAsset.dialogue[0]
            document.querySelector('#characterDialogueBox').innerHTML = firstMessage
            document.querySelector('#characterDialogueBox').style.display = 'flex'
            player.isInteracting = true
            break
            case 'w':
            keys.w.pressed = true
            lastKey = 'w'
            break
            case 'a':
            keys.a.pressed = true
            lastKey = 'a'
            break

            case 's':
            keys.s.pressed = true
            lastKey = 's'
            break

            case 'd':
            keys.d.pressed = true
            lastKey = 'd'
            break
    }
    })

    // movement listener
    window.addEventListener('keyup', (e) => {
        switch (e.key) {
            case 'w':
            keys.w.pressed = false
            break
            case 'a':
            keys.a.pressed = false
            break
            case 's':
            keys.s.pressed = false
            break
            case 'd':
            keys.d.pressed = false
            break
        }
    })

    // to check if tab is active/inactive (i think, just an initializer tho)
    let clicked = false
    addEventListener('click', () => {
        if (!clicked) {
            audio.Map.play()
            clicked = true
        }
    })
}
