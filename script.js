// Настройка Canvas
const canvas = document.getElementById('orbitCanvas');
const ctx = canvas.getContext('2d');

// Задаем внутреннее разрешение холста
function resizeCanvas() {
    canvas.width = 500;
    canvas.height = 500;
}
resizeCanvas();

// Элементы интерфейса
const sliderManeuver = document.getElementById('maneuverAngle');
const sliderInclination = document.getElementById('targetInclination');
const valManeuver = document.getElementById('valManeuver');
const valInclination = document.getElementById('valInclination');

const btnStart = document.getElementById('btnStart');
const btnReset = document.getElementById('btnReset');

const telPos = document.getElementById('telPos');
const telSpeed = document.getElementById('telSpeed');

const resDeltaV = document.getElementById('resDeltaV');
const resIdealV = document.getElementById('resIdealV');
const statusMessage = document.getElementById('statusMessage');

// Физические константы модели
const ORBIT_RADIUS = 150; // Радиус орбиты для отрисовки
const ORBIT_SPEED = 300;  // Базовая скорость КА (м/с) для расчетов
const FUEL_BUDGET = 220;  // Критический бюджет дельта-V

// Состояние симуляции
let state = {
    running: false,
    shipAngle: 0,        // Текущий угол КА на орбите (в градусах)
    maneuverAngle: 0,    // Где будет совершен маневр
    deltaI: 30,          // Изменение наклонения в градусах
    maneuverDone: false  // Выполнен ли импульс в текущем цикле
};

// Обновление значений из ползунков
function updateSliderValues() {
    state.maneuverAngle = parseInt(sliderManeuver.value);
    state.deltaI = parseInt(sliderInclination.value);
    
    valManeuver.innerText = state.maneuverAngle;
    valInclination.innerText = state.deltaI;
    
    if(!state.running) {
        draw();
    }
}

sliderManeuver.addEventListener('input', updateSliderValues);
sliderInclination.addEventListener('input', updateSliderValues);

// Математика перелёта (формула изменения наклонения)
// dV = 2 * V * sin(di / 2) * sqrt(1 / (sin(u)^2 + cos(u)^2 * cos(di)^2)) -> в упрощенном виде учитывает проекцию:
function calculateDeltaV(uDeg, diDeg) {
    const u = uDeg * Math.PI / 180;
    const di = diDeg * Math.PI / 180;
    
    // Эффективность падает, если маневр делается вне узлов (0 или 180 градусов)
    // Реальная базовая формула dV для наклонения: dV = 2 * V * sin(di/2). 
    // Но если импульс приложен не в узле, мы вынуждены тратить энергию на компенсацию дрейфа линии узлов.
    // Упрощенный коэффициент потерь: 1 / cos(минимального угла до узла)
    const angleToNode = Math.min(uDeg % 180, 180 - (uDeg % 180));
    const lossFactor = 1 + (angleToNode / 45) * 0.7; // штраф за неоптимальность
    
    const idealDV = 2 * ORBIT_SPEED * Math.sin(di / 2);
    const actualDV = idealDV * lossFactor;
    
    return {
        ideal: Math.round(idealDV),
        actual: Math.round(actualDV)
    };
}

// Отрисовка 3D-проекции орбит на 2D Canvas
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    // Центральное тело (Планета)
    ctx.beginPath();
    ctx.arc(centerX, centerY, 30, 0, 2 * Math.PI);
    ctx.fillStyle = '#1e3a8a';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#3b82f6';
    ctx.stroke();
    
    // Линия узлов (ось X, где плоскости пересекаются)
    ctx.beginPath();
    ctx.moveTo(centerX - ORBIT_RADIUS - 20, centerY);
    ctx.lineTo(centerX + ORBIT_RADIUS + 20, centerY);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.setLineDash([5, 5]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Отрисовка Исходной орбиты (Плоская окружность в проекции изометрии)
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, ORBIT_RADIUS, ORBIT_RADIUS * 0.5, 0, 0, 2 * Math.PI);
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    // Расчет параметров проекции Конечной орбиты (Наклоненный эллипс)
    // Чем больше наклон, тем сильнее сжатие по вертикали и разворот
    const tiltRad = (state.deltaI * 0.5) * Math.PI / 180;
    
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, ORBIT_RADIUS, ORBIT_RADIUS * 0.5 * Math.cos(tiltRad), tiltRad * 0.3, 0, 2 * Math.PI);
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Точка манёвра (метка на орбите)
    const mRad = state.maneuverAngle * Math.PI / 180;
    const mX = centerX + ORBIT_RADIUS * Math.cos(mRad);
    // Проекция сжатия исходной плоскости
    const mY = centerY + ORBIT_RADIUS * 0.5 * Math.sin(mRad);
    
    ctx.beginPath();
    ctx.arc(mX, mY, 6, 0, 2 * Math.PI);
    ctx.fillStyle = '#f59e0b';
    ctx.fill();
    
    // Отрисовка Космического Аппарата
    const shipRad = state.shipAngle * Math.PI / 180;
    let shipX, shipY;
    
    if (state.maneuverDone) {
        // Движется по целевой наклоненной орбите
        shipX = centerX + ORBIT_RADIUS * Math.cos(shipRad);
        shipY = centerY + ORBIT_RADIUS * 0.5 * Math.cos(tiltRad) * Math.sin(shipRad + tiltRad * 0.3);
    } else {
        // Движется по исходной орбите
        shipX = centerX + ORBIT_RADIUS * Math.cos(shipRad);
        shipY = centerY + ORBIT_RADIUS * 0.5 * Math.sin(shipRad);
    }
    
    ctx.beginPath();
    ctx.arc(shipX, shipY, 8, 0, 2 * Math.PI);
    ctx.fillStyle = '#ef4444';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.stroke();
}

// Главный цикл симуляции
function simulationLoop() {
    if (!state.running) return;
    
    // Движение спутника по орбите
    state.shipAngle = (state.shipAngle + 2) % 360;
    telPos.innerText = state.shipAngle;
    
    // Проверка достижения точки манёвра
    if (!state.maneuverDone && Math.abs(state.shipAngle - state.maneuverAngle) <= 2) {
        state.maneuverDone = true;
        evaluateManeuver();
    }
    
    draw();
    requestAnimationFrame(simulationLoop);
}

// Оценка результатов манёвра
function evaluateManeuver() {
    const costs = calculateDeltaV(state.maneuverAngle, state.deltaI);
    
    resDeltaV.innerText = costs.actual + " м/с";
    resIdealV.innerText = costs.ideal + " м/с";
    
    const isNode = (state.maneuverAngle === 0 || state.maneuverAngle === 180 || state.maneuverAngle === 360);
    
    if (costs.actual <= FUEL_BUDGET) {
        statusMessage.className = "status-msg success";
        if (isNode) {
            statusMessage.innerHTML = `<strong>Успех (Идеально)!</strong> Вы выполнили манёвр точно в узле орбиты. Затраты топлива минимальны (${costs.actual} м/с). Плоскость успешно изменена!`;
        } else {
            statusMessage.innerHTML = `<strong>Успех!</strong> Изменение плоскости выполнено. Вы уложились в лимит топлива (${FUEL_BUDGET} м/с), но затратили больше оптимального из-за смещения от узла.`;
        }
    } else {
        statusMessage.className = "status-msg error";
        statusMessage.innerHTML = `<strong>Неудача (Крах миссии)!</strong> Затраты составили ${costs.actual} м/с, что превышает запас топлива в ${FUEL_BUDGET} м/с. Изменение плоскости в этой точке крайне неэффективно. Нацельтесь на узлы орбиты (0° или 180°).`;
    }
}

// Управление кнопками
btnStart.addEventListener('click', () => {
    if (state.running) return;
    state.running = true;
    state.maneuverDone = false;
    state.shipAngle = (state.maneuverAngle + 180) % 360; // Начинаем с противоположной стороны для наглядности подлёта
    
    resDeltaV.innerText = "--";
    resIdealV.innerText = "--";
    statusMessage.className = "status-msg warning";
    statusMessage.innerText = "КА движется к точке выполнения манёвра. Ожидайте импульса...";
    
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
    statusMessage.innerText = "Настройте параметры и запустите моделирование для получения оценки.";
    
    draw();
});

// Первичная отрисовка при загрузке страницы
updateSliderValues();
