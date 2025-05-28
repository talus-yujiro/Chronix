const pd = supabase.createClient('https://ksvdggybgpwfivohbxgn.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtzdmRnZ3liZ3B3Zml2b2hieGduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA5NTUwMjYsImV4cCI6MjA1NjUzMTAyNn0.Q69y-106Q-bNmigGR4D431KSjBShR8Rw5_DMAQaKN3U');
let subjects = new Set();
let username;

function switchTab(id) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    if (id === 'history') loadStudies();
    if (id === 'graph') drawChart();
}

async function saveStudy() {
    const subject = document.getElementById('subjectInput').value.trim();
    const time = parseInt(document.getElementById('timeInput').value.trim(), 10);
    const content = document.getElementById('studyInput').value.trim();

    if (!subject || !content || isNaN(time) || time <= 0) {
        alert('正しく入力してください');
        return;
    }

    if (!username) return alert('設定>ユーザー名 でユーザー名を設定してください');

    const { error } = await pd.from('studies').insert({
        username,
        subject,
        time,
        content,
        date: new Date().toISOString()
    });

    if (error) {
        alert('保存に失敗しました');
        return;
    }

    subjects.add(subject);
    await saveSubjects();
    renderSubjectButtons();
    document.getElementById('timeInput').value = '';
    document.getElementById('studyInput').value = '';
    loadStudies();
}

async function loadStudies() {
    const filter = document.getElementById('filterSelect').value;
    const range = document.getElementById('historyRangeSelect')?.value || 'all';
    const now = new Date();

    let { data, error } = await pd.from('studies').select('*').order('date', { ascending: false });

    if (error) {
        alert('データ取得に失敗しました');
        return;
    }

    const filtered = data.filter(d => {
        const matchSubject = filter === '' || d.subject === filter;
        const matchRange = (() => {
            const dDate = new Date(d.date);
            switch (range) {
                case 'day': return isSameDay(dDate, now);
                case 'week': return isSameWeekMonday(dDate, now);
                case 'month': return isSameMonth(dDate, now);
                case 'year': return isSameYear(dDate, now);
                case 'all':
                default: return true;
            }
        })();
        return matchSubject && matchRange;
    });

    const list = document.getElementById('studyList');
    list.innerHTML = '';

    let total = 0;

    filtered.forEach(({ username, subject, time, date, content }) => {
        const div = document.createElement('div');
        const d = new Date(date);

        const title = document.createElement("h3");
        title.textContent = `${subject}`;
        title.style.color = subjectColors[subject];

        const dateContainer = document.createElement("small");
        dateContainer.textContent = `${formatDate(d)} - ${username}`;

        const body = document.createElement("p");
        body.innerHTML = `${time}分間<br>${content}`

        div.appendChild(title);
        div.appendChild(dateContainer);
        div.appendChild(body);

        list.appendChild(div);
        list.appendChild(document.createElement("hr"));
        total += time;
    });

    document.getElementById('totalTime').textContent = `合計: ${total}分`;
}

function isSameWeekMonday(d1, d2) {
    const dayOfWeek = d2.getDay() === 0 ? 6 : d2.getDay() - 1;
    const startOfWeek = new Date(d2);
    startOfWeek.setHours(0, 0, 0, 0);
    startOfWeek.setDate(d2.getDate() - dayOfWeek);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    return d1 >= startOfWeek && d1 <= endOfWeek;
}

function isSameDay(d1, d2) {
    return d1.toDateString() === d2.toDateString();
}
function isSameMonth(d1, d2) {
    return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth();
}
function isSameYear(d1, d2) {
    return d1.getFullYear() === d2.getFullYear();
}

function formatDate(date) {
    const yyyy = date.getFullYear();
    const mm = ('0' + (date.getMonth() + 1)).slice(-2);
    const dd = ('0' + date.getDate()).slice(-2);
    const hh = ('0' + date.getHours()).slice(-2);
    const min = ('0' + date.getMinutes()).slice(-2);
    return `${yyyy}/${mm}/${dd} ${hh}:${min}`;
}

function formatDateOnly(date) {
    const yyyy = date.getFullYear();
    const mm = ('0' + (date.getMonth() + 1)).slice(-2);
    const dd = ('0' + date.getDate()).slice(-2);
    return `${yyyy}-${mm}-${dd}`;
}

const subjectColors = {
    '数学': 'rgba(54, 162, 235, 0.7)',
    '英語': 'rgba(255, 99, 132, 0.7)',
    '理科': 'rgba(75, 192, 192, 0.7)',
    '社会': 'rgba(255, 205, 86, 0.7)',
    '国語': 'rgba(241, 141, 0, 0.7)',
    'その他': 'rgba(201, 203, 207, 0.7)'
};

let chartInstance = null;

async function drawChart() {
    const ctx = document.getElementById('studyChart').getContext('2d');
    if (chartInstance) chartInstance.destroy();

    const { data, error } = await pd.from('studies').select('*');

    if (error) {
        alert('グラフデータの取得に失敗しました');
        return;
    }

    const now = new Date();
    const days = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        days.push(formatDateOnly(d));
    }

    const uniqueSubjects = [...new Set(data.map(d => d.subject))];
    const subjectData = {};
    uniqueSubjects.forEach(sub => {
        subjectData[sub] = days.map(() => 0);
    });

    data.forEach(({ subject, date, time }) => {
        const d = formatDateOnly(new Date(date));
        const idx = days.indexOf(d);
        if (idx !== -1 && subject in subjectData) {
            subjectData[subject][idx] += time;
        }
    });

    const datasets = uniqueSubjects.map(sub => ({
        label: sub,
        data: subjectData[sub],
        backgroundColor: subjectColors[sub] || subjectColors['その他']
    }));

    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: days,
            datasets
        },
        options: {
            responsive: true,
            scales: {
                x: {
                    stacked: true,
                    title: { display: true, text: '日付' }
                },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    title: { display: true, text: '学習時間（分）' }
                }
            },
            plugins: {
                legend: { position: 'top' }
            }
        }
    });
}

async function renderSubjectButtons() {
    const container = document.getElementById('subjectButtons');
    container.innerHTML = '';
    for (const subject of subjects) {
        const button = document.createElement('button');
        button.className = 'subject-button';
        button.textContent = subject;
        button.addEventListener('click', () => {
            document.querySelectorAll('.subject-button').forEach(btn => btn.classList.remove('selected'));
            button.classList.add('selected');
            document.getElementById('subjectInput').value = subject;
        });
        container.appendChild(button);
    }
}

async function saveSubjects() {
    for (const name of subjects) {
        await pd.from('subject').upsert({ name }, { onConflict: ['name'] });
    }
}

async function loadSubjects() {
    const { data, error } = await pd.from('subject').select('name');
    if (error) {
        alert('教科一覧の取得に失敗しました');
        return;
    }
    subjects = new Set(data.map(d => d.name));
    renderSubjectButtons();
}

async function addSubject() {
    const input = document.getElementById('newSubjectInput');
    const newSubject = input.value.trim();
    if (!newSubject) {
        alert('教科名を入力してください。');
        return;
    }
    if (subjects.has(newSubject)) {
        alert('この教科はすでに存在します。');
        return;
    }

    subjects.add(newSubject);
    await saveSubjects();
    loadSubjects();
    updateSubjectListUI();
    input.value = '';
}

function updateSubjectListUI() {
    const list = document.getElementById('subjectList');
    list.innerHTML = '';
    [...subjects].sort().forEach(subject => {
        const li = document.createElement('li');
        li.textContent = subject;
        list.appendChild(li);
    });
}

function settingUsername() {
    username = document.getElementById("userName").value.trim();
    localStorage.setItem('username', username);
}

document.addEventListener('DOMContentLoaded', async () => {
    await loadSubjects();
    loadStudies();
    renderSubjectButtons();
    document.getElementById("userName").value = localStorage.getItem("username");
    settingUsername();
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('service-worker.js');
    }
});
