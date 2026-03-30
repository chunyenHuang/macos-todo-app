let todos = [];
let trash = [];

const input = document.getElementById('new-todo');
const todoList = document.getElementById('todo-list');
const doneList = document.getElementById('done-list');
const trashList = document.getElementById('trash-list');
const emptyState = document.getElementById('empty-state');
const doneEmptyState = document.getElementById('done-empty-state');
const trashEmptyState = document.getElementById('trash-empty-state');
const emptyTrashBtn = document.getElementById('empty-trash-btn');

/** http(s) or www… segments (URL may be embedded in a sentence). */
const URL_IN_TEXT_RE = /https?:\/\/[^\s<>"'()[\]{}]+|www\.[^\s<>"'()[\]{}]+/gi;

/** Strip trailing punctuation that usually isn’t part of the URL. */
function trimUrlTail(raw) {
  let s = raw;
  for (let i = 0; i < 8; i++) {
    const next = s.replace(/[.,;:!?*]+$/u, '').replace(/['")\]>]+$/u, '');
    if (next === s) break;
    s = next;
  }
  return s;
}

/** Validate match → safe href + link label (only http/https). */
function safeUrlFromMatch(raw) {
  const trimmed = trimUrlTail(raw);
  if (!trimmed) return null;
  let toParse = trimmed;
  if (/^www\./i.test(toParse)) toParse = `https://${toParse}`;
  if (!/^https?:\/\//i.test(toParse)) return null;
  try {
    const u = new URL(toParse);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return { href: u.href, label: trimmed };
  } catch {
    return null;
  }
}

/**
 * Plain span, or span.todo-text containing text + <a class="todo-link"> for each URL segment.
 */
function createTodoTextEl(text) {
  const span = document.createElement('span');
  span.className = 'todo-text';

  if (!text) {
    return span;
  }

  URL_IN_TEXT_RE.lastIndex = 0;
  let last = 0;
  let m;
  let anyLink = false;

  while ((m = URL_IN_TEXT_RE.exec(text)) !== null) {
    const raw = m[0];
    if (m.index > last) {
      span.appendChild(document.createTextNode(text.slice(last, m.index)));
    }
    const info = safeUrlFromMatch(raw);
    if (info) {
      anyLink = true;
      const a = document.createElement('a');
      a.className = 'todo-link';
      a.href = info.href;
      a.textContent = info.label;
      a.rel = 'noopener noreferrer';
      a.title = info.href;
      const open = info.href;
      a.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.api.openExternal(open);
      });
      span.appendChild(a);
    } else {
      span.appendChild(document.createTextNode(raw));
    }
    last = m.index + raw.length;
  }

  if (!anyLink && last === 0) {
    span.textContent = text;
    return span;
  }

  if (last < text.length) {
    span.appendChild(document.createTextNode(text.slice(last)));
  }

  return span;
}

/** Wrap text/link in a slot so inline edit can replace contents. */
function createTodoTextSlot(text) {
  const slot = document.createElement('div');
  slot.className = 'todo-text-slot';
  slot.appendChild(createTodoTextEl(text));
  return slot;
}

let activeEdit = null;

function findTodoById(id) {
  return todos.find((t) => t.id === id) || trash.find((t) => t.id === id);
}

/** Start inline edit for a row. Commits any other open editor first. */
function startEditTodoItem(todoId, li) {
  const todo = findTodoById(todoId);
  if (!todo) return;

  if (activeEdit) {
    activeEdit.commit();
    activeEdit = null;
  }

  const slot = li.querySelector('.todo-text-slot');
  if (!slot) return;

  const original = todo.text;
  let closed = false;

  slot.innerHTML = '';
  const inp = document.createElement('input');
  inp.type = 'text';
  inp.className = 'todo-edit-input';
  inp.value = original;
  slot.appendChild(inp);
  inp.focus();
  inp.select();

  const restoreDisplay = () => {
    slot.innerHTML = '';
    slot.appendChild(createTodoTextEl(todo.text));
  };

  const commit = () => {
    if (closed) return;
    closed = true;
    activeEdit = null;
    const v = inp.value.trim();
    if (v) todo.text = v;
    save();
    restoreDisplay();
  };

  const cancel = () => {
    if (closed) return;
    closed = true;
    activeEdit = null;
    restoreDisplay();
  };

  let ignoreBlur = false;
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      ignoreBlur = true;
      commit();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      ignoreBlur = true;
      cancel();
    }
  });
  inp.addEventListener('blur', () => {
    setTimeout(() => {
      if (ignoreBlur) {
        ignoreBlur = false;
        return;
      }
      if (!closed) commit();
    }, 0);
  });

  activeEdit = { commit, cancel };
}

function activeTodos() {
  return todos.filter((t) => !t.done);
}

function completedTodos() {
  return todos.filter((t) => t.done);
}

function updateBadge() {
  window.api.updateBadge(activeTodos().length);
}

/** Reorder within active, completed, or trash slice; order is stored in `todos` / `trash`. */
function applyReorder(kind, from, to) {
  if (from === to || from < 0 || to < 0) return;
  if (kind === 'active') {
    const active = todos.filter((t) => !t.done);
    if (from >= active.length || to >= active.length) return;
    const [moved] = active.splice(from, 1);
    active.splice(to, 0, moved);
    let i = 0;
    for (let j = 0; j < todos.length; j++) {
      if (!todos[j].done) todos[j] = active[i++];
    }
    save();
    renderTodos();
  } else if (kind === 'done') {
    const done = todos.filter((t) => t.done);
    if (from >= done.length || to >= done.length) return;
    const [moved] = done.splice(from, 1);
    done.splice(to, 0, moved);
    let i = 0;
    for (let j = 0; j < todos.length; j++) {
      if (todos[j].done) todos[j] = done[i++];
    }
    save();
    renderDone();
  } else if (kind === 'trash') {
    if (from >= trash.length || to >= trash.length) return;
    const [moved] = trash.splice(from, 1);
    trash.splice(to, 0, moved);
    save();
    renderTrash();
  }
}

let dragReorderKind = null;

function makeDragHandle() {
  const span = document.createElement('span');
  span.className = 'drag-handle';
  span.textContent = '⋮⋮';
  span.setAttribute('draggable', 'true');
  span.title = 'Drag to reorder';
  return span;
}

function bindDragReorder() {
  const lists = [
    [todoList, 'active'],
    [doneList, 'done'],
    [trashList, 'trash'],
  ];

  for (const [ul, kind] of lists) {
    ul.addEventListener('dragstart', (e) => {
      const h = e.target.closest('.drag-handle');
      if (!h || !ul.contains(h)) return;
      const li = h.closest('li[data-todo-id]');
      if (!li) return;
      dragReorderKind = kind;
      e.dataTransfer.setData(
        'application/x-todo-reorder',
        JSON.stringify({ kind, id: li.dataset.todoId }),
      );
      e.dataTransfer.effectAllowed = 'move';
      li.classList.add('is-dragging');
    });

    ul.addEventListener('dragover', (e) => {
      if (dragReorderKind !== kind) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const li = e.target.closest('li[data-todo-id]');
      ul.querySelectorAll('.drag-over').forEach((x) => x.classList.remove('drag-over'));
      if (li && ul.contains(li) && !li.classList.contains('is-dragging')) {
        li.classList.add('drag-over');
      }
    });

    ul.addEventListener('dragleave', (e) => {
      const li = e.target.closest('li[data-todo-id]');
      if (li && ul.contains(li) && !li.contains(e.relatedTarget)) {
        li.classList.remove('drag-over');
      }
    });

    ul.addEventListener('drop', (e) => {
      e.preventDefault();
      ul.querySelectorAll('.drag-over').forEach((x) => x.classList.remove('drag-over'));
      let data;
      try {
        data = JSON.parse(e.dataTransfer.getData('application/x-todo-reorder'));
      } catch {
        return;
      }
      if (!data || data.kind !== kind) return;
      const targetLi = e.target.closest('li[data-todo-id]');
      if (!targetLi || !ul.contains(targetLi)) return;
      const draggedId = String(data.id);
      if (draggedId === targetLi.dataset.todoId) return;
      const lis = [...ul.querySelectorAll('li[data-todo-id]')];
      const from = lis.findIndex((l) => l.dataset.todoId === draggedId);
      const to = lis.indexOf(targetLi);
      if (from < 0 || to < 0) return;
      applyReorder(kind, from, to);
    });
  }

  document.addEventListener('dragend', () => {
    dragReorderKind = null;
    document.querySelectorAll('.is-dragging, .drag-over').forEach((el) => {
      el.classList.remove('is-dragging', 'drag-over');
    });
  });
}

async function init() {
  const data = await window.api.getTodos();
  todos = data.todos || [];
  trash = data.trash || [];
  updateBadge();
  render();
  input.focus();
}

function save() {
  window.api.saveTodos({ todos, trash });
  updateBadge();
}

function renderTodos() {
  const list = activeTodos();
  todoList.innerHTML = '';
  emptyState.style.display = list.length === 0 ? 'block' : 'none';

  for (const todo of list) {
    const li = document.createElement('li');
    li.className = 'todo-item';
    li.dataset.todoId = String(todo.id);
    li.appendChild(makeDragHandle());

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = false;
    checkbox.title = 'Mark done';
    checkbox.addEventListener('change', () => toggleTodo(todo.id));

    const slot = createTodoTextSlot(todo.text);

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'edit-btn';
    editBtn.textContent = '✎';
    editBtn.title = 'Edit';
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      startEditTodoItem(todo.id, li);
    });

    const btn = document.createElement('button');
    btn.className = 'delete-btn';
    btn.textContent = '×';
    btn.title = 'Move to trash';
    btn.addEventListener('click', () => deleteTodo(todo.id));

    li.appendChild(checkbox);
    li.appendChild(slot);
    li.appendChild(editBtn);
    li.appendChild(btn);
    todoList.appendChild(li);
  }
}

function renderDone() {
  const list = completedTodos();
  doneList.innerHTML = '';
  doneEmptyState.style.display = list.length === 0 ? 'block' : 'none';

  for (const todo of list) {
    const li = document.createElement('li');
    li.className = 'todo-item done';
    li.dataset.todoId = String(todo.id);
    li.appendChild(makeDragHandle());

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = true;
    checkbox.title = 'Mark not done';
    checkbox.addEventListener('change', () => toggleTodo(todo.id));

    const slot = createTodoTextSlot(todo.text);

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'edit-btn';
    editBtn.textContent = '✎';
    editBtn.title = 'Edit';
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      startEditTodoItem(todo.id, li);
    });

    const btn = document.createElement('button');
    btn.className = 'delete-btn';
    btn.textContent = '×';
    btn.title = 'Move to trash';
    btn.addEventListener('click', () => deleteTodo(todo.id));

    li.appendChild(checkbox);
    li.appendChild(slot);
    li.appendChild(editBtn);
    li.appendChild(btn);
    doneList.appendChild(li);
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
    li.dataset.todoId = String(todo.id);
    li.appendChild(makeDragHandle());

    const slot = createTodoTextSlot(todo.text);

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'edit-btn';
    editBtn.textContent = '✎';
    editBtn.title = 'Edit';
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      startEditTodoItem(todo.id, li);
    });

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

    li.appendChild(slot);
    li.appendChild(editBtn);
    li.appendChild(restoreBtn);
    li.appendChild(permDeleteBtn);
    trashList.appendChild(li);
  }
}

function render() {
  renderTodos();
  renderDone();
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
    renderDone();
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

document.getElementById('quit-btn').addEventListener('click', () => {
  window.api.quitApp();
});

// Tab switching
document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    const which = tab.dataset.tab;
    document.getElementById('panel-todos').hidden = which !== 'todos';
    document.getElementById('panel-done').hidden = which !== 'done';
    document.getElementById('panel-trash').hidden = which !== 'trash';
    if (which === 'todos') input.focus();
  });
});

bindDragReorder();
init();
