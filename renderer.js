let todos = [];
let trash = [];

const input = document.getElementById('new-todo');
const todoList = document.getElementById('todo-list');
const trashList = document.getElementById('trash-list');
const emptyState = document.getElementById('empty-state');
const trashEmptyState = document.getElementById('trash-empty-state');
const emptyTrashBtn = document.getElementById('empty-trash-btn');

async function init() {
  const data = await window.api.getTodos();
  todos = data.todos || [];
  trash = data.trash || [];
  window.api.updateBadge(todos.length);
  render();
  input.focus();
}

function save() {
  window.api.saveTodos({ todos, trash });
  window.api.updateBadge(todos.length);
}

function renderTodos() {
  todoList.innerHTML = '';
  emptyState.style.display = todos.length === 0 ? 'block' : 'none';

  for (const todo of todos) {
    const li = document.createElement('li');
    li.className = 'todo-item' + (todo.done ? ' done' : '');

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = todo.done;
    checkbox.addEventListener('change', () => toggleTodo(todo.id));

    const span = document.createElement('span');
    span.className = 'todo-text';
    span.textContent = todo.text;

    const btn = document.createElement('button');
    btn.className = 'delete-btn';
    btn.textContent = '×';
    btn.title = 'Move to trash';
    btn.addEventListener('click', () => deleteTodo(todo.id));

    li.appendChild(checkbox);
    li.appendChild(span);
    li.appendChild(btn);
    todoList.appendChild(li);
  }
}

function renderTrash() {
  trashList.innerHTML = '';
  const isEmpty = trash.length === 0;
  trashEmptyState.style.display = isEmpty ? 'block' : 'none';
  emptyTrashBtn.hidden = isEmpty;

  for (const todo of trash) {
    const li = document.createElement('li');
    li.className = 'todo-item done';

    const span = document.createElement('span');
    span.className = 'todo-text';
    span.textContent = todo.text;

    const restoreBtn = document.createElement('button');
    restoreBtn.className = 'restore-btn';
    restoreBtn.textContent = '↩';
    restoreBtn.title = 'Restore';
    restoreBtn.addEventListener('click', () => restoreTodo(todo.id));

    const permDeleteBtn = document.createElement('button');
    permDeleteBtn.className = 'delete-btn perm';
    permDeleteBtn.textContent = '×';
    permDeleteBtn.title = 'Delete forever';
    permDeleteBtn.addEventListener('click', () => permanentDelete(todo.id));

    li.appendChild(span);
    li.appendChild(restoreBtn);
    li.appendChild(permDeleteBtn);
    trashList.appendChild(li);
  }
}

function render() {
  renderTodos();
  renderTrash();
}

function addTodo(text) {
  text = text.trim();
  if (!text) return;
  todos.push({ id: Date.now(), text, done: false });
  save();
  renderTodos();
}

function toggleTodo(id) {
  const todo = todos.find((t) => t.id === id);
  if (todo) {
    todo.done = !todo.done;
    save();
    renderTodos();
  }
}

function deleteTodo(id) {
  const idx = todos.findIndex((t) => t.id === id);
  if (idx !== -1) {
    trash.unshift(todos.splice(idx, 1)[0]);
    save();
    render();
  }
}

function restoreTodo(id) {
  const idx = trash.findIndex((t) => t.id === id);
  if (idx !== -1) {
    todos.push(trash.splice(idx, 1)[0]);
    save();
    render();
  }
}

function permanentDelete(id) {
  trash = trash.filter((t) => t.id !== id);
  save();
  renderTrash();
}

emptyTrashBtn.addEventListener('click', () => {
  trash = [];
  save();
  renderTrash();
});

input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    addTodo(input.value);
    input.value = '';
  }
});

// Tab switching
document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    const which = tab.dataset.tab;
    document.getElementById('panel-todos').hidden = which !== 'todos';
    document.getElementById('panel-trash').hidden = which !== 'trash';
    if (which === 'todos') input.focus();
  });
});

init();
