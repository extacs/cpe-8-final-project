const canvas = document.querySelector('canvas')
const c = canvas.getContext('2d')

canvas.width = 1920
canvas.height = 1080


function resizeCanvas() {
  const windowWidth = window.innerWidth;
  const windowHeight = window.innerHeight;

  // aspect ratioing
  const scale = Math.min(windowWidth / 1920, windowHeight / 1080);

  canvas.style.width = `${1920 * scale}px`;
  canvas.style.height = `${1080 * scale}px`;

  canvas.style.position = 'relative';
  canvas.style.left = `${(windowWidth - (1920 * scale)) / 2}px`;
  canvas.style.top = `${(windowHeight - (1080 * scale)) / 2}px`;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// must be true 1:1 to tile sizes set on Tiled app
mapTileWidth = 70
mapTileHeight = 40

// the single block that holds the pathways the system must load 
// (maps1 & maps2 for now)
currentMap = MAP_ASSETS.MAP1

// this is for future player skin modifications
currentPlayer = SPRITE_ASSETS.PLAYER 

// clear these arrays if SWITCHING MAPS
// Global Arrays (for switching map logics)
const boundaries = []
const mapPortals = [] // map_portal zone for changing maps 
const mainSpawnZone = [] // main spawnzone (will add more spawn zones for different map soon)
let offset = currentMap.spawnPoint // spawn/initial offset (it is also where the will focus/center)



// list for characters
const characters = []
const villagerImg = new Image()
const oldManImg = new Image()


// first initialization (acts like as a starting point, so that initMap() can be reused later on)
const mapImage = new Image()
mapImage.src = currentMap.background
const foregroundImage = new Image()
foregroundImage.src = currentMap.foreground

const playerDownImage = new Image()
playerDownImage.src = currentPlayer.playerDown

const playerUpImage = new Image()
playerUpImage.src = currentPlayer.playerUp

const playerLeftImage = new Image()
playerLeftImage.src = currentPlayer.playerLeft

const playerRightImage = new Image()
playerRightImage.src = currentPlayer.playerRight

// Player initializer 
const player = new Sprite({
    position: {
        x: canvas.width / 2 - 224 / 4 / 2,
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
    let animationId = window.requestAnimationFrame(animate)

    renderables.forEach((renderable) => {
        renderable.draw()
    })

    let moving = true
    player.animate = false

    // <------------- MAP PORTAL system end ------------->
    if (keys.w.pressed || keys.a.pressed || keys.s.pressed || keys.d.pressed) {
        for (let i = 0; i < mapPortals.length; i++) {
            const mapPortal = mapPortals[i]
            const overlappingArea =
                (Math.min(
                player.position.x + player.width,
                mapPortal.position.x + mapPortal.width
                ) -
                Math.max(player.position.x, mapPortal.position.x)) *
                (Math.min(
                player.position.y + player.height,
                mapPortal.position.y + mapPortal.height
                ) -
                Math.max(player.position.y, mapPortal.position.y))
            // colliding = true, then do this:
            if (
                rectangularMapPortal({
                    rectangle1: player,
                    rectangle2: mapPortal
                }) && overlappingArea > (player.width * player.height) / 2
            ) {
                console.log("Im getting tp'd.")
                // deactivate current animation loop 
                // Transition to map2
                window.cancelAnimationFrame(animationId)
                if (currentMap == MAP_ASSETS.MAP1) {
                    currentMap = MAP_ASSETS.MAP2
                }
                else {
                    currentMap = MAP_ASSETS.MAP1
                }
                initMap(currentMap); // This is what's causing the "pause"
    
                animationId = window.requestAnimationFrame(animate)
                return 
            }
        }
    }
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

let imagesLoaded = 0
const totalImagesToLoad = 6 // background, foreground, 4 player directions

function trackLoading() {
    imagesLoaded++
    if (imagesLoaded === totalImagesToLoad) {
        console.log("All assets synced. Starting game...")
        animate()
    }
}


initMap(currentMap)
mapImage.onload = trackLoading
foregroundImage.onload = trackLoading
playerDownImage.onload = trackLoading
playerUpImage.onload = trackLoading
playerLeftImage.onload = trackLoading
playerRightImage.onload = trackLoading


// INTERACTION SYSTEM (currently not working)
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
console.log(imagesLoaded)

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

Howler.html5PoolSize = 100;
// to check if tab is active/inactive (i think, just an initializer tho)
let clicked = false
addEventListener('click', () => {
    if (!clicked) {
        audio.Map.play()
        clicked = true
    }
    else if (!audio.Map.playing()) {
        audio.Map.play();
    }
})
