const canvas = document.getElementById('orbitCanvas');
const ctx = canvas.getContext('2d');

canvas.width = 500;
canvas.height = 500;

// Интерфейс
const sliderManeuver = document.getElementById('maneuverAngle');
const sliderInclination = document.getElementById('targetInclination');
const inputFuelLimit = document.getElementById('fuelLimit');
const valManeuver = document.getElementById('valManeuver');
const valInclination = document.getElementById('valInclination');

const btnStart = document.getElementById('btnStart');
const btnReset = document.getElementById('btnReset');
const telPos = document.getElementById('telPos');
const resDeltaV = document.getElementById('resDeltaV');
const resIdealV = document.getElementById('resIdealV');
const statusMessage = document.getElementById('statusMessage');

// Параметры 3D камеры (углы вращения)
let camera = { Beta: 0.5, Alpha: 0.6 }; // начальный ракурс наклона сцены
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };

// Константы
const ORBIT_RADIUS = 140;
const ORBIT_SPEED = 300;

// Состояние
let state = {
    running: false,
    shipAngle: 0,
    maneuverAngle: 0,
    deltaI: 30,
    maneuverDone: false
};

// Функция 3D-проекции (превращает X,Y,Z в экранные X,Y)
function project3D(x, y, z) {
    // Вращение вокруг оси Y (Alpha)
    let x1 = x * Math.cos(camera.Alpha) - z * Math.sin(camera.Alpha);
    let z1 = x * Math.sin(camera.Alpha) + z * Math.cos(camera.Alpha);
    
    // Вращение вокруг оси X (Beta)
    let y2 = y * Math.cos(camera.Beta) - z1 * Math.sin(camera.Beta);
    
    // Центрирование на Canvas
    return {
        x: canvas.width / 2 + x1,
        y: canvas.height / 2 - y2
    };
}

function updateSliderValues() {
    state.maneuverAngle = parseInt(sliderManeuver.value);
    state.deltaI = parseInt(sliderInclination.value);
    valManeuver.innerText = state.maneuverAngle;
    valInclination.innerText = state.deltaI;
    draw();
}

sliderManeuver.addEventListener('input', updateSliderValues);
sliderInclination.addEventListener('input', updateSliderValues);

function calculateDeltaV(uDeg, diDeg) {
    const di = diDeg * Math.PI / 180;
    const angleToNode = Math.min(uDeg % 180, 180 - (uDeg % 180));
    const lossFactor = 1 + (angleToNode / 45) * 0.8; // Моделирование потерь не в узле
    
    const idealDV = 2 * ORBIT_SPEED * Math.sin(di / 2);
    const actualDV = idealDV * lossFactor;
    
    return { ideal: Math.round(idealDV), actual: Math.round(actualDV) };
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 1. Центральная планета
    const planetPos = project3D(0, 0, 0);
    ctx.beginPath();
    ctx.arc(planetPos.x, planetPos.y, 25, 0, 2 * Math.PI);
    ctx.fillStyle = '#1e3a8a';
    ctx.fill();
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 2. Линия узлов (Пересечение плоскостей, ось X)
    ctx.beginPath();
    let pNodeLeft = project3D(-ORBIT_RADIUS - 30, 0, 0);
    let pNodeRight = project3D(ORBIT_RADIUS + 30, 0, 0);
    ctx.moveTo(pNodeLeft.x, pNodeLeft.y);
    ctx.lineTo(pNodeRight.x, pNodeRight.y);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 3. Исходная орбита (базовая горизонтальная плоскость Z-X, Y=0)
    ctx.beginPath();
    for (let a = 0; a <= 360; a += 2) {
        let rad = a * Math.PI / 180;
        let pt = project3D(ORBIT_RADIUS * Math.cos(rad), 0, ORBIT_RADIUS * Math.sin(rad));
        if (a === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y);
    }
    ctx.strokeStyle = 'rgba(100, 116, 139, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 4. Целевая наклоненная орбита (Повернута вокруг линии узлов X на угол deltaI)
    ctx.beginPath();
    const diRad = state.deltaI * Math.PI / 180;
    for (let a = 0; a <= 360; a += 2) {
        let rad = a * Math.PI / 180;
        // Вектор на базовой орбите
        let x0 = ORBIT_RADIUS * Math.cos(rad);
        let z0 = ORBIT_RADIUS * Math.sin(rad);
        // Вращаем вокруг оси X на угол наклонения
        let yNew = z0 * Math.sin(diRad);
        let zNew = z0 * Math.cos(diRad);
        
        let pt = project3D(x0, yNew, zNew);
        if (a === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y);
    }
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 5. Точка манёвра (желтый маркер на исходной плоскости)
    const mRad = state.maneuverAngle * Math.PI / 180;
    const mPt = project3D(ORBIT_RADIUS * Math.cos(mRad), 0, ORBIT_RADIUS * Math.sin(mRad));
    ctx.beginPath();
    ctx.arc(mPt.x, mPt.y, 6, 0, 2 * Math.PI);
    ctx.fillStyle = '#f59e0b';
    ctx.fill();

    // 6. Космический Аппарат
    const shipRad = state.shipAngle * Math.PI / 180;
    let sX = ORBIT_RADIUS * Math.cos(shipRad);
    let sY = 0, sZ = ORBIT_RADIUS * Math.sin(shipRad);
    
    if (state.maneuverDone) {
        // Перешел на новую 3D плоскость
        sY = sZ * Math.sin(diRad);
        sZ = sZ * Math.cos(diRad);
    }
    
    const sPt = project3D(sX, sY, sZ);
    ctx.beginPath();
    ctx.arc(sPt.x, sPt.y, 8, 0, 2 * Math.PI);
    ctx.fillStyle = '#ef4444';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
}

function simulationLoop() {
    if (!state.running) return;
    
    state.shipAngle = (state.shipAngle + 2) % 360;
    telPos.innerText = state.shipAngle;
    
    if (!state.maneuverDone && Math.abs(state.shipAngle - state.maneuverAngle) <= 2) {
        state.maneuverDone = true;
        evaluateManeuver();
    }
    
    draw();
    requestAnimationFrame(simulationLoop);
}

function evaluateManeuver() {
    const costs = calculateDeltaV(state.maneuverAngle, state.deltaI);
    const userFuelLimit = parseInt(inputFuelLimit.value) || 220; // Чтение кастомного лимита
    
    resDeltaV.innerText = costs.actual + " м/с";
    resIdealV.innerText = costs.ideal + " м/с";
    
    if (costs.actual <= userFuelLimit) {
        statusMessage.className = "status-msg success";
        statusMessage.innerHTML = `<strong>Успех!</strong> Плоскость изменена. Затраты топлива (${costs.actual} м/с) уложились в ваш лимит (${userFuelLimit} м/с).`;
    } else {
        statusMessage.className = "status-msg error";
        statusMessage.innerHTML = `<strong>Миссия провалена!</strong> Затраты составили ${costs.actual} м/с. Это выше вашего лимита в ${userFuelLimit} м/с. Измените точку манёвра ближе к узлам (0° или 180°), либо увеличьте бак.`;
    }
}

// Слушатели вращения мыши/пальца (3D Интерактив)
const vSection = document.querySelector('.visual-section');
function startDrag(e) {
    isDragging = true;
    previousMousePosition = { x: e.clientX || e.touches[0].clientX, y: e.clientY || e.touches[0].clientY };
}
function drag(e) {
    if (!isDragging) return;
    const clientX = e.clientX || (e.touches ? e.touches[0].clientX : 0);
    const clientY = e.clientY || (e.touches ? e.touches[0].clientY : 0);
    
    let deltaX = clientX - previousMousePosition.x;
    let deltaY = clientY - previousMousePosition.y;
    
    camera.Alpha += deltaX * 0.01;
    camera.Beta += deltaY * 0.01;
    
    // Ограничение наклона по вертикали, чтобы сцена не переворачивалась вверх ногами
    camera.Beta = Math.max(0.1, Math.min(Math.PI / 2 - 0.1, camera.Beta));
    
    previousMousePosition = { x: clientX, y: clientY };
    draw();
}
function stopDrag() { isDragging = false; }

vSection.addEventListener('mousedown', startDrag);
window.addEventListener('mousemove', drag);
window.addEventListener('mouseup', stopDrag);

vSection.addEventListener('touchstart', startDrag);
window.addEventListener('touchmove', drag);
window.addEventListener('touchend', stopDrag);

// Кнопки
btnStart.addEventListener('click', () => {
    if (state.running) return;
    state.running = true;
    state.maneuverDone = false;
    state.shipAngle = (state.maneuverAngle + 180) % 360; 
    statusMessage.className = "status-msg warning";
    statusMessage.innerText = "Космический аппарат летит к точке импульса... Поворачивайте камеру для обзора.";
    simulationLoop();
});

btnReset.addEventListener('click', () => {
    state.running = false;
    state.maneuverDone = false;
    state.shipAngle = 0;
    sliderManeuver.value = 0;
    sliderInclination.value = 30;
    updateSliderValues();
    resDeltaV.innerText = "--";
    resIdealV.innerText = "--";
    statusMessage.className = "status-msg";
    statusMessage.innerText = "Параметры сброшены. Вращайте холст для выбора ракурса.";
});

updateSliderValues();
