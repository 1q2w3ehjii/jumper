// 게임 상수 및 변수 설정
const GRAVITY = 30;
const JUMP_FORCE = 15;
const PLAYER_SPEED = 10;
const MAX_HEALTH = 10;
const SAFE_FALL_HEIGHT = 3; // 안전하게 떨어질 수 있는 높이 (블록 단위)
const DASH_MULTIPLIER = 2.5; // 대시 속도 배율
const DASH_COOLDOWN = 10; // 대시 쿨타임 (초)

// 게임 상태 변수
let gameStarted = false;
let gameOver = false;
let startTime = 0;
let currentTime = 0;

// 플레이어 상태 변수
let playerVelocity = new THREE.Vector3();
let playerOnGround = false;
let playerHealth = MAX_HEALTH;
let lastGroundHeight = 0; // 마지막으로 지면에 있었을 때의 높이
let thirdPersonView = false;
let canDash = true; // 대시 가능 여부
let lastDashTime = 0; // 마지막 대시 시간

// 키 상태 추적
const keys = {
    KeyW: false,
    KeyA: false,
    KeyS: false,
    KeyD: false,
    Space: false,
    ShiftLeft: false,
    ShiftRight: false
};

// 배경음악
let bgMusic;

// Three.js 변수
let scene, camera, renderer, controls;
let player, playerCollider;
let cameraOffset = new THREE.Vector3(0, 2, 5);
let clock = new THREE.Clock();

// 게임 오브젝트 저장소
let platforms = [];
let breakablePlatforms = [];
let bouncePlatforms = [];
let goal;

// 게임 초기화
function init() {
    // 배경음악 설정
    bgMusic = new Audio('점프! 점프! 점프!.mp3');
    bgMusic.loop = true; // 무한 재생
    bgMusic.volume = 0.5; // 볼륨 설정
    
    // 씬 생성
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB); // 하늘색 배경
    scene.fog = new THREE.Fog(0x87CEEB, 20, 100); // 안개 효과

    // 카메라 설정
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 2, 0);

    // 렌더러 설정
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.getElementById('game-container').appendChild(renderer.domElement);

    // 조명 설정
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.camera.left = -25;
    directionalLight.shadow.camera.right = 25;
    directionalLight.shadow.camera.top = 25;
    directionalLight.shadow.camera.bottom = -25;
    scene.add(directionalLight);

    // 컨트롤 설정
    controls = new THREE.PointerLockControls(camera, document.body);
    scene.add(controls.getObject());

    // 플레이어 생성
    createPlayer();

    // 레벨 생성
    createLevel();

    // 이벤트 리스너 설정
    setupEventListeners();

    // 게임 시작
    document.addEventListener('click', startGame, { once: true });

    // 애니메이션 루프 시작
    animate();
}

// 플레이어 생성
function createPlayer() {
    // 플레이어 메쉬 생성
    const geometry = new THREE.BoxGeometry(1, 2, 1);
    const material = new THREE.MeshLambertMaterial({ color: 0x3333ff });
    player = new THREE.Mesh(geometry, material);
    player.castShadow = true;
    player.receiveShadow = true;
    player.position.set(0, 2, 0);
    scene.add(player);

    // 플레이어 충돌체 생성
    playerCollider = new THREE.Box3().setFromObject(player);
}

// 레벨 생성
function createLevel() {
    // 시작 플랫폼 (회색)
    createPlatform(0, 0, 0, 5, 0.5, 5, 0x808080);

    // 일반 플랫폼들 (회색) - 500 높이까지 생성
    let height = 0;
    let x = 7;
    let z = 0;
    
    // 플랫폼 생성 패턴 (지그재그 패턴으로 상승)
    while (height < 500) {
        // 일반 플랫폼 (회색)
        createPlatform(x, height, z, 3, 0.5, 3, 0x808080);
        
        // 다음 플랫폼 위치 계산
        x += 5 + Math.random() * 3;
        z += (Math.random() - 0.5) * 8;
        height += 1 + Math.random() * 2;
        
        // 가끔 무너지는 플랫폼 추가 (약 15% 확률)
        if (Math.random() < 0.15) {
            createBreakablePlatform(x, height, z, 3, 0.5, 3);
            x += 5 + Math.random() * 3;
            z += (Math.random() - 0.5) * 8;
            height += 1 + Math.random() * 2;
        }
        
        // 가끔 튕겨내는 플랫폼 추가 (약 10% 확률)
        if (Math.random() < 0.1) {
            // 튕기는 방향은 항상 위쪽으로 설정
            const bounceDir = new THREE.Vector3(0, 1, 0);
            createBouncePlatform(x, height, z, 3, 0.5, 3, bounceDir);
            x += 5 + Math.random() * 3;
            z += (Math.random() - 0.5) * 8;
            height += 3 + Math.random() * 4; // 튕겨내는 플랫폼 후에는 더 높게 점프
        }
    }
    
    // 최종 목적지 플랫폼 (핑크색) - 마지막 플랫폼 위치에 배치
    createGoalPlatform(x, height, z, 5, 0.5, 5);
    
    // 바닥 (낙하 시 리셋용)
    createPlatform(0, -20, 0, 5000, 0.5, 5000, 0x555555, false);
}

// 일반 플랫폼 생성
function createPlatform(x, y, z, width, height, depth, color, receiveShadow = true) {
    const geometry = new THREE.BoxGeometry(width, height, depth);
    const material = new THREE.MeshLambertMaterial({ color: color });
    const platform = new THREE.Mesh(geometry, material);
    platform.position.set(x, y, z);
    platform.receiveShadow = receiveShadow;
    scene.add(platform);
    
    // 충돌 감지용 바운딩 박스 생성
    const boundingBox = new THREE.Box3().setFromObject(platform);
    platforms.push({ mesh: platform, boundingBox: boundingBox });
    
    return platform;
}

// 무너지는 플랫폼 생성
function createBreakablePlatform(x, y, z, width, height, depth) {
    const platform = createPlatform(x, y, z, width, height, depth, 0xff0000);
    
    // 금이 간 효과 추가
    const crackGeometry = new THREE.EdgesGeometry(platform.geometry);
    const crackMaterial = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });
    const cracks = new THREE.LineSegments(crackGeometry, crackMaterial);
    platform.add(cracks);
    
    // 무너지는 플랫폼 정보 저장
    breakablePlatforms.push({
        mesh: platform,
        boundingBox: new THREE.Box3().setFromObject(platform),
        timeToBreak: 2, // 2초 후 무너짐
        timer: null,
        broken: false
    });
    
    return platform;
}

// 튕겨내는 플랫폼 생성
function createBouncePlatform(x, y, z, width, height, depth, bounceDirection) {
    const platform = createPlatform(x, y, z, width, height, depth, 0x00ff00);
    
    // 화살표 추가 (튕겨내는 방향 표시)
    const arrowLength = Math.max(width, depth) * 0.5;
    const arrowDir = bounceDirection.clone().normalize();
    const arrowHelper = new THREE.ArrowHelper(
        arrowDir,
        new THREE.Vector3(0, height/2 + 0.1, 0),
        arrowLength,
        0xffff00,
        arrowLength * 0.3,
        arrowLength * 0.2
    );
    platform.add(arrowHelper);
    
    // 튕겨내는 플랫폼 정보 저장
    bouncePlatforms.push({
        mesh: platform,
        boundingBox: new THREE.Box3().setFromObject(platform),
        direction: bounceDirection.clone().normalize(),
        force: 20 // 튕겨내는 힘
    });
    
    return platform;
}

// 목표 플랫폼 생성
function createGoalPlatform(x, y, z, width, height, depth) {
    // 핑크색 목표 플랫폼
    const platform = createPlatform(x, y, z, width, height, depth, 0xFF69B4);
    
    // 목표 지점 표시용 기둥 추가
    const pillarGeometry = new THREE.CylinderGeometry(0.5, 0.5, 5, 16);
    const pillarMaterial = new THREE.MeshLambertMaterial({ color: 0xFF69B4 });
    const pillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
    pillar.position.set(0, 2.5, 0);
    pillar.castShadow = true;
    platform.add(pillar);
    
    // 목표 지점 정보 저장
    goal = {
        mesh: platform,
        boundingBox: new THREE.Box3().setFromObject(platform)
    };
    
    return platform;
}

// 이벤트 리스너 설정
function setupEventListeners() {
    // 키보드 이벤트
    document.addEventListener('keydown', (event) => {
        if (keys.hasOwnProperty(event.code)) {
            keys[event.code] = true;
            
            // 게임 시작 (W, A, S, D 중 하나를 누르면 시작)
            if (!gameStarted && (event.code === 'KeyW' || event.code === 'KeyA' || event.code === 'KeyS' || event.code === 'KeyD')) {
                startGame();
            }
            
            // 시점 전환 (F3)
            if (event.code === 'F3') {
                toggleCameraView();
            }
            
            // 대시 (Shift)
            if ((event.code === 'ShiftLeft' || event.code === 'ShiftRight') && canDash) {
                dash();
            }
        }
    });
    
    document.addEventListener('keyup', (event) => {
        if (keys.hasOwnProperty(event.code)) {
            keys[event.code] = false;
        }
    });
    
    // 마우스 이벤트
    document.addEventListener('mousemove', (event) => {
        if (gameStarted && !gameOver) {
            // 1인칭 모드에서는 PointerLockControls가 처리
            if (thirdPersonView) {
                // 3인칭 모드에서 추가 처리 가능
            }
        }
    });
    
    // 창 크기 변경 이벤트
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
    
    // 재시작 버튼
    document.getElementById('restart-button').addEventListener('click', restartGame);
}

// 게임 시작
function startGame() {
    if (!gameStarted) {
        controls.lock();
        gameStarted = true;
        startTime = performance.now();
        document.getElementById('instructions').classList.add('hidden');
        document.getElementById('start-message').classList.add('hidden');
        updateHealthUI();
        
        // 배경음악 재생
        bgMusic.play().catch(error => {
            console.error('배경음악 재생 실패:', error);
        });
    }
}

// 게임 재시작
function restartGame() {
    // 플레이어 위치 초기화
    player.position.set(0, 2, 0);
    playerVelocity.set(0, 0, 0);
    
    // 무너진 플랫폼 복구
    breakablePlatforms.forEach(platform => {
        if (platform.broken) {
            platform.mesh.visible = true;
            platform.broken = false;
            if (platform.timer) {
                clearTimeout(platform.timer);
                platform.timer = null;
            }
        }
    });
    
    // 게임 상태 초기화
    gameOver = false;
    playerHealth = MAX_HEALTH;
    lastGroundHeight = 0;
    startTime = performance.now();
    document.getElementById('game-over').classList.add('hidden');
    updateHealthUI();
    controls.lock();
}

// 체력 UI 업데이트
function updateHealthUI() {
    const hearts = document.querySelectorAll('.heart');
    
    hearts.forEach((heart, index) => {
        if (index < playerHealth) {
            heart.classList.remove('empty');
        } else {
            heart.classList.add('empty');
        }
    });
}

// 플레이어 피해 처리
function damagePlayer(amount) {
    playerHealth -= amount;
    
    if (playerHealth <= 0) {
        playerHealth = 0;
        gameOver = true;
        endGame(false);
    }
    
    updateHealthUI();
}

// 대시 기능
function dash() {
    if (!canDash) return;
    
    // 현재 시간 확인
    const currentTime = performance.now() / 1000;
    
    // 쿨타임 확인
    if (currentTime - lastDashTime < DASH_COOLDOWN) {
        return;
    }
    
    // 대시 방향 계산 (카메라 방향 기준)
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    direction.y = 0;
    direction.normalize();
    
    // 대시 속도 적용
    playerVelocity.x += direction.x * PLAYER_SPEED * DASH_MULTIPLIER;
    playerVelocity.z += direction.z * PLAYER_SPEED * DASH_MULTIPLIER;
    
    // 대시 쿨타임 설정
    lastDashTime = currentTime;
    
    // 대시 시각 효과 (필요시 추가)
    // ...
}

// 시점 전환 (1인칭/3인칭)
function toggleCameraView() {
    thirdPersonView = !thirdPersonView;
    
    if (thirdPersonView) {
        // 3인칭 시점으로 전환
        controls.unlock();
    } else {
        // 1인칭 시점으로 전환
        controls.lock();
    }
}

// 플레이어 이동 처리
function updatePlayerMovement(deltaTime) {
    // 중력 적용
    if (!playerOnGround) {
        playerVelocity.y -= GRAVITY * deltaTime;
    } else {
        // 지면에 있을 때 현재 높이 저장
        lastGroundHeight = player.position.y;
    }
    
    // 지상에서의 마찰 (감속)
    if (playerOnGround) {
        playerVelocity.x *= 0.9;
        playerVelocity.z *= 0.9;
    }
    
    // 키 입력에 따른 이동
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    direction.y = 0;
    direction.normalize();
    
    const sideDirection = new THREE.Vector3(-direction.z, 0, direction.x);
    
    if (keys.KeyW) {
        playerVelocity.x += direction.x * PLAYER_SPEED * deltaTime;
        playerVelocity.z += direction.z * PLAYER_SPEED * deltaTime;
    }
    
    if (keys.KeyS) {
        playerVelocity.x -= direction.x * PLAYER_SPEED * deltaTime;
        playerVelocity.z -= direction.z * PLAYER_SPEED * deltaTime;
    }
    
    if (keys.KeyA) {
        playerVelocity.x -= sideDirection.x * PLAYER_SPEED * deltaTime;
        playerVelocity.z -= sideDirection.z * PLAYER_SPEED * deltaTime;
    }
    
    if (keys.KeyD) {
        playerVelocity.x += sideDirection.x * PLAYER_SPEED * deltaTime;
        playerVelocity.z += sideDirection.z * PLAYER_SPEED * deltaTime;
    }
    
    // 점프
    if (keys.Space && playerOnGround) {
        playerVelocity.y = JUMP_FORCE;
        playerOnGround = false;
    }
    
    // 속도 제한
    const maxSpeed = 20;
    const horizontalSpeed = Math.sqrt(playerVelocity.x * playerVelocity.x + playerVelocity.z * playerVelocity.z);
    if (horizontalSpeed > maxSpeed) {
        const scale = maxSpeed / horizontalSpeed;
        playerVelocity.x *= scale;
        playerVelocity.z *= scale;
    }
    
    // 위치 업데이트
    player.position.x += playerVelocity.x * deltaTime;
    player.position.y += playerVelocity.y * deltaTime;
    player.position.z += playerVelocity.z * deltaTime;
    
    // 충돌체 업데이트
    playerCollider.setFromObject(player);
    
    // 카메라 위치 업데이트
    if (thirdPersonView) {
        // 3인칭 시점
        const cameraTarget = player.position.clone();
        cameraTarget.y += 1; // 플레이어 중심보다 약간 위를 바라봄
        
        // 카메라 위치 계산 (플레이어 뒤쪽)
        const cameraDirection = new THREE.Vector3();
        camera.getWorldDirection(cameraDirection);
        cameraDirection.negate(); // 반대 방향
        
        const cameraPosition = cameraTarget.clone();
        cameraPosition.add(cameraDirection.multiplyScalar(5)); // 5 유닛 뒤
        cameraPosition.y += 2; // 약간 위에서 내려다봄
        
        camera.position.copy(cameraPosition);
        camera.lookAt(cameraTarget);
    } else {
        // 1인칭 시점
        controls.getObject().position.copy(player.position);
        controls.getObject().position.y += 1; // 눈높이
    }
}

// 충돌 감지 및 처리
function handleCollisions() {
    const wasOnGround = playerOnGround;
    playerOnGround = false;
    
    // 일반 플랫폼과의 충돌 검사
    platforms.forEach(platform => {
        if (playerCollider.intersectsBox(platform.boundingBox)) {
            handlePlatformCollision(platform.boundingBox);
            
            // 높이에 따른 피해 계산 (착지 시)
            if (!wasOnGround && playerOnGround) {
                const fallHeight = lastGroundHeight - player.position.y;
                if (fallHeight > SAFE_FALL_HEIGHT) {
                    // 안전 높이를 초과하는 경우 피해 계산
                    const damageBlocks = Math.floor(fallHeight - SAFE_FALL_HEIGHT);
                    const damage = damageBlocks;
                    if (damage > 0) {
                        damagePlayer(damage);
                    }
                }
            }
        }
    });
    
    // 무너지는 플랫폼과의 충돌 검사
    breakablePlatforms.forEach(platform => {
        if (!platform.broken && playerCollider.intersectsBox(platform.boundingBox)) {
            handlePlatformCollision(platform.boundingBox);
            
            // 높이에 따른 피해 계산 (착지 시)
            if (!wasOnGround && playerOnGround) {
                const fallHeight = lastGroundHeight - player.position.y;
                if (fallHeight > SAFE_FALL_HEIGHT) {
                    // 안전 높이를 초과하는 경우 피해 계산
                    const damageBlocks = Math.floor(fallHeight - SAFE_FALL_HEIGHT);
                    const damage = damageBlocks;
                    if (damage > 0) {
                        damagePlayer(damage);
                    }
                }
            }
            
            // 타이머 설정 (아직 설정되지 않은 경우)
            if (!platform.timer) {
                platform.timer = setTimeout(() => {
                    platform.mesh.visible = false;
                    platform.broken = true;
                }, platform.timeToBreak * 1000);
            }
        }
    });
    
    // 튕겨내는 플랫폼과의 충돌 검사
    bouncePlatforms.forEach(platform => {
        if (playerCollider.intersectsBox(platform.boundingBox)) {
            // 일반 충돌 처리
            handlePlatformCollision(platform.boundingBox);
            
            // 튕겨내는 효과 적용
            const bounceVector = platform.direction.clone().multiplyScalar(platform.force);
            playerVelocity.add(bounceVector);
        }
    });
    
    // 목표 지점과의 충돌 검사
    if (goal && playerCollider.intersectsBox(goal.boundingBox)) {
        if (!gameOver) {
            gameOver = true;
            endGame(true);
        }
    }
    
    // 낙하 감지 (y < -10)
    if (player.position.y < -10) {
        damagePlayer(MAX_HEALTH); // 맵 밖으로 떨어지면 모든 체력 소실
    }
}

// 플랫폼과의 충돌 처리
function handlePlatformCollision(platformBox) {
    const playerBox = playerCollider;
    
    // 충돌 방향 계산
    const playerMin = playerBox.min;
    const playerMax = playerBox.max;
    const platformMin = platformBox.min;
    const platformMax = platformBox.max;
    
    // 플레이어의 아래쪽과 플랫폼의 위쪽 사이의 거리
    const bottomTop = playerMin.y - platformMax.y;
    // 플레이어의 위쪽과 플랫폼의 아래쪽 사이의 거리
    const topBottom = platformMin.y - playerMax.y;
    // 플레이어의 오른쪽과 플랫폼의 왼쪽 사이의 거리
    const rightLeft = playerMax.x - platformMin.x;
    // 플레이어의 왼쪽과 플랫폼의 오른쪽 사이의 거리
    const leftRight = platformMax.x - playerMin.x;
    // 플레이어의 앞쪽과 플랫폼의 뒤쪽 사이의 거리
    const frontBack = playerMax.z - platformMin.z;
    // 플레이어의 뒤쪽과 플랫폼의 앞쪽 사이의 거리
    const backFront = platformMax.z - playerMin.z;
    
    // 가장 작은 침투 거리 찾기
    const distances = [
        { dir: 'bottomTop', val: Math.abs(bottomTop) },
        { dir: 'topBottom', val: Math.abs(topBottom) },
        { dir: 'rightLeft', val: Math.abs(rightLeft) },
        { dir: 'leftRight', val: Math.abs(leftRight) },
        { dir: 'frontBack', val: Math.abs(frontBack) },
        { dir: 'backFront', val: Math.abs(backFront) }
    ];
    
    distances.sort((a, b) => a.val - b.val);
    const minPenetration = distances[0];
    
    // 충돌 방향에 따른 처리
    switch (minPenetration.dir) {
        case 'bottomTop':
            // 플레이어가 플랫폼 위에 있음
            player.position.y = platformMax.y + (playerMax.y - playerMin.y) / 2;
            playerVelocity.y = 0;
            playerOnGround = true;
            break;
            
        case 'topBottom':
            // 플레이어가 플랫폼 아래에 있음
            player.position.y = platformMin.y - (playerMax.y - playerMin.y) / 2;
            playerVelocity.y = 0;
            break;
            
        case 'rightLeft':
            // 플레이어가 플랫폼 왼쪽에 있음
            player.position.x = platformMin.x - (playerMax.x - playerMin.x) / 2;
            playerVelocity.x = 0;
            break;
            
        case 'leftRight':
            // 플레이어가 플랫폼 오른쪽에 있음
            player.position.x = platformMax.x + (playerMax.x - playerMin.x) / 2;
            playerVelocity.x = 0;
            break;
            
        case 'frontBack':
            // 플레이어가 플랫폼 뒤쪽에 있음
            player.position.z = platformMin.z - (playerMax.z - playerMin.z) / 2;
            playerVelocity.z = 0;
            break;
            
        case 'backFront':
            // 플레이어가 플랫폼 앞쪽에 있음
            player.position.z = platformMax.z + (playerMax.z - playerMin.z) / 2;
            playerVelocity.z = 0;
            break;
    }
    
    // 충돌체 업데이트
    playerCollider.setFromObject(player);
}

// 게임 종료 처리
function endGame(success = true) {
    controls.unlock();
    gameOver = true;
    // 타이머는 계속 유지 (죽은 후에도 타이머 계속 작동)
    
    if (success) {
        // 목표 달성 성공
        const finalTime = (performance.now() - startTime) / 1000;
        document.getElementById('final-time').textContent = finalTime.toFixed(1);
        document.getElementById('game-over').classList.remove('hidden');
    } else {
        // 체력이 0이 되어 실패
        document.getElementById('game-over').querySelector('h2').textContent = '게임 오버!';
        document.getElementById('game-over').classList.remove('hidden');
    }
}

// 게임 상태 업데이트
function updateGameState() {
    if (gameStarted) {
        currentTime = (performance.now() - startTime) / 1000;
        document.getElementById('timer').textContent = `시간: ${currentTime.toFixed(1)}초`;
        
        // 대시 쿨타임 업데이트
        const currentTimeSeconds = performance.now() / 1000;
        if (currentTimeSeconds - lastDashTime >= DASH_COOLDOWN) {
            canDash = true;
        }
    }
}

// 애니메이션 루프
function animate() {
    requestAnimationFrame(animate);
    
    if (gameStarted) {
        // 게임 상태 업데이트는 항상 수행 (타이머 유지)
        updateGameState();
        
        if (!gameOver) {
            const deltaTime = Math.min(clock.getDelta(), 0.1); // 최대 0.1초로 제한 (프레임 드롭 방지)
            
            updatePlayerMovement(deltaTime);
            handleCollisions();
        }
    }
    
    renderer.render(scene, camera);
}

// 게임 초기화 및 시작
init();