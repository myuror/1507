const canvas = document.getElementById('orbitCanvas');
const ctx = canvas.getContext('2d');

// Элементы управления
const maneuverAngleInput = document.getElementById('maneuverAngle');
const inclinationDeltaInput = document.getElementById('inclinationDelta');
const maneuverAngleVal = document.getElementById('maneuverAngleVal');
const inclinationDeltaVal = document.getElementById('inclinationDeltaVal');
const startBtn = document.getElementById('startBtn');
const resetBtn = document.getElementById('resetBtn');

// Элементы вывода результатов
const resultSection = document.getElementById('resultSection');
const resDeltaV = document.getElementById('resDeltaV');
const resMinDeltaV = document.getElementById('resMinDeltaV');
const resEfficiency = document.getElementById('resEfficiency');
const verdictBox = document.getElementById('verdictBox');
const verdictTitle = document.getElementById('verdictTitle');
const verdictText = document.getElementById('verdictText');

// Настройки 3D камеры (углы вращения сцены)
let cameraAngleX = 65 * Math.PI / 180; 
let cameraAngleZ = -30 * Math.PI / 180; 

// Переменные для интерактивного вращения мышкой
let isDragging = false;
let previousMouseX = 0;
let previousMouseY = 0;

// Параметры орбиты
const a = 110; 
const b = 85;  
const e = Math.sqrt(1 - (b * b) / (a * a)); 
const focalDist = a * e; 
const mu = 350000; 

// Состояния анимации корабля и импульса
let shipAnomaly = 0; 
let isManeuvering = false; 
let animProgress = 0; 
let hasManeuvered = false; 

function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
}

// 3D проекция
function project3D(x, y, z) {
    let x1 = x * Math.cos(cameraAngleZ) - y * Math.sin(cameraAngleZ);
    let y1 = x * Math.sin(cameraAngleZ) + y * Math.cos(cameraAngleZ);
    
    let x2 = x1;
    let y2 = y1 * Math.cos(cameraAngleX) - z * Math.sin(cameraAngleX);
    let z2 = y1 * Math.sin(cameraAngleX) + z * Math.cos(cameraAngleX);

    const cx = canvas.width / (2 * (window.devicePixelRatio || 1));
    const cy = canvas.height / (2 * (window.devicePixelRatio || 1));

    return { x: cx + x2, y: cy + y2, z: z2 };
}

// Расчет скорости КА
function getOrbitalVelocity(angleRad) {
    const r = (a * (1 - e * e)) / (1 + e * Math.cos(angleRad));
    return Math.sqrt(mu * (2 / r - 1 / a));
}

function drawScene() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const mAngleDeg = parseFloat(maneuverAngleInput.value);
    const mAngleRad = (mAngleDeg * Math.PI) / 180;
    const incDeltaDeg = parseFloat(inclinationDeltaInput.value);
    const incRad = (incDeltaDeg * Math.PI) / 180;

    // 1. Центральная планета
    const planetProj = project3D(0, 0, 0);
    ctx.beginPath();
    ctx.arc(planetProj.x, planetProj.y, 14, 0, 2 * Math.PI);
    ctx.fillStyle = '#1e3a8a';
    ctx.fill();

    // 2. Исходная орбита
    ctx.beginPath();
    for (let i = 0; i <= 360; i += 2) {
        let rad = (i * Math.PI) / 180;
        let x = a * Math.cos(rad) - focalDist;
        let y = b * Math.sin(rad);
        let pt = project3D(x, y, 0);

        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
    }
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 3. Новая орбита
    if (isManeuvering || hasManeuvered) {
        ctx.beginPath();
        for (let i = 0; i <= 360; i += 2) {
            let rad = (i * Math.PI) / 180;
            let x_flat = a * Math.cos(rad) - focalDist;
            let y_flat = b * Math.sin(rad);

            let z3d = Math.sin(rad - mAngleRad) * a * Math.sin(incRad * animProgress);
            let y3d_simple = y_flat * Math.cos(incRad * animProgress);

            let pt = project3D(x_flat, y3d_simple, z3d);

            if (i === 0) ctx.moveTo(pt.x, pt.y);
            else ctx.lineTo(pt.x, pt.y);
        }
        ctx.strokeStyle = `rgba(16, 185, 129, ${Math.max(0.2, animProgress)})`;
        ctx.lineWidth = 2.5;
        ctx.stroke();
    }

    // 4. Точка маневра
    let mx = a * Math.cos(mAngleRad) - focalDist;
    let my = b * Math.sin(mAngleRad);
    let targetProj = project3D(mx, my, 0);

    ctx.beginPath();
    ctx.arc(targetProj.x, targetProj.y, 6, 0, 2 * Math.PI);
    ctx.fillStyle = '#f59e0b';
    ctx.fill();

    // 5. Корабль и импульс
    let shipX = a * Math.cos(shipAnomaly) - focalDist;
    let shipY = b * Math.sin(shipAnomaly);
    let shipZ = 0;

    if (hasManeuvered) {
        shipZ = Math.sin(shipAnomaly - mAngleRad) * a * Math.sin(incRad);
        shipY = shipY * Math.cos(incRad);
    }

    let shipProj = project3D(shipX, shipY, shipZ);

    if (isManeuvering) {
        let vectorProj = project3D(shipX, shipY, shipZ + (incDeltaDeg * 0.8));
        ctx.beginPath();
        ctx.moveTo(shipProj.x, shipProj.y);
        ctx.lineTo(vectorProj.x, vectorProj.y);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 3;
        ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(shipProj.x, shipProj.y, 5, 0, 2 * Math.PI);
    ctx.fillStyle = isManeuvering ? '#ef4444' : '#f97316';
    ctx.fill();

    // Обновление текстовой инфо-панели (защита от отсутствия элементов в HTML)
    const telemetryContainer = document.querySelector('.telemetry-overlay');
    if (telemetryContainer) {
        const currentV = getOrbitalVelocity(shipAnomaly);
        const currentDeg = Math.round(shipAnomaly * 180 / Math.PI) % 360;
        telemetryContainer.innerHTML = `
            <div>Скорость корабля: <b>${Math.round(currentV * 10)}</b> м/с</div>
            <div>Угол (аномалия): <b>${currentDeg}°</b></div>
            <div style="font-size:10px; color:#8da2bb; margin-top:4px;">💡 Сцену можно вращать мышкой</div>
        `;
    }
}

function updatePhysics() {
    if (!isManeuvering) {
        let r = (a * (1 - e * e)) / (1 + e * Math.cos(shipAnomaly));
        let angularVelocity = Math.sqrt(mu / (r * r * r)) * 0.4; 
        shipAnomaly += angularVelocity;
        
        if (shipAnomaly > 2 * Math.PI) {
            shipAnomaly -= 2 * Math.PI;
        }

        if (window.targetAnomaly !== undefined && !hasManeuvered) {
            let diff = Math.abs(shipAnomaly - window.targetAnomaly);
            if (diff < 0.08 || diff > 2 * Math.PI - 0.08) {
                shipAnomaly = window.targetAnomaly; 
                isManeuvering = true;
                animProgress = 0;
            }
        }
    } else {
        animProgress += 0.02;
        if (animProgress >= 1) {
            animProgress = 1;
            isManeuvering = false;
            hasManeuvered = true;
            window.targetAnomaly = undefined;
            
            calculateManeuver();
            if (resultSection) resultSection.classList.remove('hidden');
            maneuverAngleInput.disabled = false;
            inclinationDeltaInput.disabled = false;
        }
    }
}

function calculateManeuver() {
    const thetaDeg = parseFloat(maneuverAngleInput.value);
    const thetaRad = (thetaDeg * Math.PI) / 180;
    const deltaiDeg = parseFloat(inclinationDeltaInput.value);
    const deltaiRad = (deltaiDeg * Math.PI) / 180;

    const V = getOrbitalVelocity(thetaRad) * 10; 
    const dV = 2 * V * Math.sin(deltaiRad / 2);

    const V_min = getOrbitalVelocity(Math.PI) * 10;
    const min_dV = 2 * V_min * Math.sin(deltaiRad / 2);

    let efficiency = dV > 0 ? Math.min(100, Math.round((min_dV / dV) * 100)) : 100;

    if (resDeltaV) resDeltaV.textContent = Math.round(dV) + ' м/с';
    if (resMinDeltaV) resMinDeltaV.textContent = Math.round(min_dV) + ' м/с';
    if (resEfficiency) resEfficiency.textContent = efficiency + '%';

    if (verdictBox) {
        verdictBox.className = 'verdict-box';
        let textHTML = ''; 

        if (efficiency >= 90) {
            verdictBox.classList.add('verdict-success');
            if (verdictTitle) verdictTitle.textContent = '🚀 Успех! Оптимальный манёвр';
            textHTML = `Вы выполнили манёвр на угле ${thetaDeg}° (вблизи Апоцентра). Здесь орбитальная скорость минимальна (${Math.round(V)} м/с), что позволило изменить наклонение плоскости с минимальными затратами характеристической скорости (&Delta;V).`;
        } else {
            verdictBox.classList.add('verdict-warning');
            if (verdictTitle) verdictTitle.textContent = '⚠️ Неоптимальный манёвр';
            textHTML = `Затраты &Delta;V составили ${Math.round(dV)} м/с. Изменение наклонения на угле ${thetaDeg}° неэффективно, так как корабль находится близко к перицентру, где его скорость максимальна (${Math.round(V)} м/с). Затраты энергии пропорциональны текущей скорости аппарата.`;
        }
        
        if (verdictText) verdictText.innerHTML = textHTML;
    }
}

function gameLoop() {
    updatePhysics();
    drawScene();
    requestAnimationFrame(gameLoop);
}

function startSimulation() {
    if (isManeuvering || hasManeuvered) return;
    
    const mAngleDeg = parseFloat(maneuverAngleInput.value);
    window.targetAnomaly = (mAngleDeg * Math.PI) / 180;

    if (resultSection) resultSection.classList.add('hidden');
    maneuverAngleInput.disabled = true;
    inclinationDeltaInput.disabled = true;
}

function resetSimulation() {
    isManeuvering = false;
    hasManeuvered = false;
    window.targetAnomaly = undefined;
    animProgress = 0;
    shipAnomaly = 0;
    
    maneuverAngleInput.disabled = false;
    inclinationDeltaInput.disabled = false;
    maneuverAngleInput.value = 0;
    inclinationDeltaInput.value = 15;
    
    if (resultSection) resultSection.classList.add('hidden');
    maneuverAngleVal.textContent = '0°';
    inclinationDeltaVal.textContent = '15°';
}

// Вращение сцены мышкой
canvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    previousMouseX = e.clientX;
    previousMouseY = e.clientY;
});
window.addEventListener('mousemove', (e) => {
if (!isDragging) return;
let deltaX = e.clientX - previousMouseX;
let deltaY = e.clientY - previousMouseY;
cameraAngleZ += deltaX * 0.01;
cameraAngleX += deltaY * 0.01;
cameraAngleX = Math.max(0.1, Math.min(Math.PI / 2 - 0.05, cameraAngleX));
previousMouseX = e.clientX;
previousMouseY = e.clientY;
});
window.addEventListener('mouseup', () => { isDragging = false; });
// Обработка тач-событий для смартфонов (исправленная безопасная логика)
canvas.addEventListener('touchstart', (e) => {
if (e.touches && e.touches[0]) {
isDragging = true;
previousMouseX = e.touches[0].clientX;
previousMouseY = e.touches[0].clientY;
}
}, { passive: true });
window.addEventListener('touchmove', (e) => {
if (!isDragging || !e.touches || !e.touches[0]) return;
let deltaX = e.touches[0].clientX - previousMouseX;
let deltaY = e.touches[0].clientY - previousMouseY;
cameraAngleZ += deltaX * 0.01;
cameraAngleX += deltaY * 0.01;
cameraAngleX = Math.max(0.1, Math.min(Math.PI / 2 - 0.05, cameraAngleX));
previousMouseX = e.touches[0].clientX;
previousMouseY = e.touches[0].clientY;
}, { passive: true });
window.addEventListener('touchend', () => { isDragging = false; });
// Слушатели ползунков
maneuverAngleInput.addEventListener('input', () => {
maneuverAngleVal.textContent = maneuverAngleInput.value + '°';
});
inclinationDeltaInput.addEventListener('input', () => {
inclinationDeltaVal.textContent = inclinationDeltaInput.value + '°';
});
startBtn.addEventListener('click', startSimulation);
resetBtn.addEventListener('click', resetSimulation);
// Старт программы
window.addEventListener('resize', resizeCanvas);
resizeCanvas();
gameLoop();
