import { ref } from 'vue'
export type Language = 'en' | 'ru'
function initial(): Language {
  try {
    return localStorage.getItem('focusflow.language') === 'ru' ? 'ru' : 'en'
  } catch {
    return 'en'
  }
}
export const language = ref<Language>(initial())
export function setLanguage(value: Language) {
  language.value = value
  document.documentElement.lang = value
  try {
    localStorage.setItem('focusflow.language', value)
  } catch {
    /* Session-only preference. */
  }
}
const ru: Record<string, string> = {
  'Could not restore the workspace. Saved data is preserved.':
    'Не удалось восстановить рабочее пространство. Сохранённые данные не изменены.',
  'Some focus history is damaged. Valid data is restored; saved data is preserved.':
    'Часть истории повреждена. Доступные данные восстановлены; сохранённые данные не изменены.',
  'Saved data unavailable. Changes stay in this visit; existing data is preserved.':
    'Сохранённые данные недоступны. Изменения действуют до закрытия страницы; прежние данные не изменены.',
  'Clock change detected. Timer paused; resume when ready. Saved on this device.':
    'Обнаружено изменение часов. Таймер приостановлен. Данные сохранены на устройстве.',
  'Could not save on this device. Changes stay in this visit.':
    'Не удалось сохранить данные. Изменения действуют до закрытия страницы.',
  'Saved plan unavailable. Changes stay in this visit; saved data is preserved.':
    'Сохранённый план недоступен. Изменения действуют до закрытия страницы; прежние данные не изменены.',
  'Could not save the plan. Changes stay in this visit.':
    'Не удалось сохранить план. Изменения действуют до закрытия страницы.',
  'Saved memory is damaged or unavailable. Changes to suggestions stay in this visit; saved data is preserved.':
    'Запомненные задачи повреждены или недоступны. Изменения подсказок действуют до закрытия страницы; прежние данные не изменены.',
  'Could not save task memory. Suggestions stay in this visit.':
    'Не удалось сохранить запомненные задачи. Подсказки доступны до закрытия страницы.',
  'Workspace ownership ended unexpectedly.': 'Доступ активной вкладки неожиданно завершился.',
  'Could not acquire or retain workspace ownership.':
    'Не удалось получить или сохранить доступ активной вкладки.',
  'Unavailable task': 'Недоступная задача',
  'Task was deleted': 'Задача удалена',
  'Active work exceeds remaining budget; timer continues':
    'Текущая работа превышает оставшееся время; таймер продолжает работать',
  'Does not fit the available time': 'Не помещается в доступное время',
  'Your space is clear': 'Здесь пока нет задач',
  'Read-only · Timer snapshot': 'Только чтение · Состояние таймера',
  'Choose an unfinished task to begin': 'Выберите незавершённую задачу',
  'Time is up · Focus time is still being recorded.':
    'Время вышло · Время фокуса продолжает учитываться.',
  'Time is up. Continue focus, add time or complete.':
    'Время вышло. Продолжите фокус, добавьте время или завершите задачу.',
  'Ready when you are': 'Можно начинать',
  'Proposed schedule': 'Предложенный план',
  'Accepted session': 'Принятый план',
  'Pause timer': 'Приостановить таймер',
  'Start or resume timer': 'Запустить или продолжить таймер',
  Break: 'Перерыв',
  'Unknown (legacy)': 'Без категории (старая запись)',
  'Use 1–1,440 minutes, breaks of 0–60 minutes, and a frequency of 1–20 tasks.':
    'Укажите 1–1440 минут, перерывы 0–60 минут каждые 1–20 задач.',
  'Tasks or available time changed. Generate a fresh proposal.':
    'Задачи или доступное время изменились. Составьте новый план.',
  'This plan belongs to another day. Generate and accept a new proposal to carry work forward.':
    'Этот план относится к другому дню. Составьте и примите новый план.',
  'Recovery did not resolve the error. Export your data before reloading this page.':
    'Восстановление не устранило ошибку. Экспортируйте данные перед перезагрузкой.',
  'Recovery JSON prepared. It may contain incomplete or damaged data; review before restoring.':
    'JSON подготовлен. Он может содержать неполные или повреждённые данные; проверьте их перед восстановлением.',
  'Could not prepare the recovery file. Keep this tab open and try again.':
    'Не удалось подготовить файл. Не закрывайте вкладку и повторите попытку.',
  'Read-only — safe editing requires a browser with Web Locks support and a secure connection.':
    'Только чтение — для безопасного редактирования нужен браузер с Web Locks и защищённое соединение.',
  'Read-only — waiting for workspace ownership. Close the other FocusFlow tab to edit here.':
    'Только чтение — закройте другую вкладку FocusFlow для редактирования здесь.',
  'Read-only — workspace editing is unavailable.': 'Только чтение — редактирование недоступно.',
  'Try reopening the interface, or export a recovery copy below. An unfinished form may need to be entered again.':
    'Откройте интерфейс снова или экспортируйте копию для восстановления. Незавершённую форму может потребоваться заполнить заново.',
  'Accuracy = 100% minus mean absolute percentage error versus actual time, floored at 0%. Sessions under one minute are excluded from accuracy. It is a historical comparison, not a prediction guarantee.':
    'Точность — 100% минус средняя абсолютная ошибка относительно фактического времени, не ниже 0%. Сессии короче минуты исключены. Это сравнение истории, а не гарантия прогноза.',
  'older records lack complete timing intervals: unlocated focus is assigned to the completion date. Missing categories remain unknown.':
    'старых записей не содержат полных интервалов: нераспределённое время отнесено к дате завершения. Отсутствующие категории остаются неизвестными.',
  Tasks: 'Задачи',
  'Add task': 'Добавить задачу',
  'Add a task': 'Добавить задачу',
  'Create a task': 'Создать задачу',
  'Ready to begin? Press': 'Готовы приступить? Нажмите',
  'Start Focus': 'Начать фокус',
  min: 'мин',
  'Session progress': 'Прогресс сессии',
  'Open task panel': 'Открыть задачи',
  'Back to tasks': 'К задачам',
  'to do': 'осталось',
  'tasks to do ·': 'задач осталось ·',
  'min planned': 'мин запланировано',
  Planner: 'Планировщик',
  Analytics: 'Аналитика',
  Appearance: 'Темы',
  Data: 'Данные',
  'Your tasks': 'Ваши задачи',
  'Time to focus.': 'Время сосредоточиться.',
  'Set up your first task.': 'Настройте первую задачу.',
  'A little focus.\nStart with one task.': 'Немного внимания.\nНачните с одной задачи.',
  'A little focus.': 'Немного внимания.',
  'Start with one task.': 'Начните с одной задачи.',
  'Refine your task.': 'Измените задачу.',
  'Make time for a task.': 'Выделите время для задачи.',
  'Task updated.': 'Задача обновлена.',
  'Task added.': 'Задача добавлена.',
  'Task deleted': 'Задача удалена',
  Undo: 'Вернуть',
  'Export recovery JSON': 'Экспорт JSON для восстановления',
  'Export JSON': 'Экспорт JSON',
  'Import JSON': 'Импорт JSON',
  'Reset workspace': 'Сбросить приложение',
  'Reset this device?': 'Сбросить данные на устройстве?',
  'Replace this workspace?': 'Заменить текущие данные?',
  'All tasks, history, remembered tasks and preferences on this device will be removed.':
    'Все задачи, история, запомненные задачи и настройки на этом устройстве будут удалены.',
  'Your current tasks, history and preferences will be replaced. Export a copy first if you need them.':
    'Текущие задачи, история и настройки будут заменены. При необходимости сначала экспортируйте копию.',
  'Reset everything': 'Удалить все данные',
  'Import backup': 'Восстановить копию',
  'This file is not a valid FocusFlow backup. Your data has not changed.':
    'Файл не является корректной копией FocusFlow. Ваши данные не изменены.',
  'Backup downloaded.': 'Резервная копия скачана.',
  'Could not export data. Please try again.': 'Не удалось экспортировать данные. Попробуйте снова.',
  'Could not update storage. Keep this tab open and try again.':
    'Не удалось обновить хранилище. Не закрывайте вкладку и повторите попытку.',
  'Data changes are available in the active tab.': 'Изменение данных доступно в активной вкладке.',
  'Time remaining': 'Оставшееся время',
  'Planned ·': 'Запланировано ·',
  'Reset timer': 'Сбросить таймер',
  'Complete task and select next': 'Завершить задачу и перейти к следующей',
  '+5 min': '+5 мин',
  'Focus timer': 'Таймер фокуса',
  Overview: 'Обзор',
  Sessions: 'Сессии',
  'Analytics view': 'Раздел аналитики',
  'Focus today': 'Фокус сегодня',
  'This week': 'На этой неделе',
  'Last 7 days': 'Последние 7 дней',
  'minutes on': 'минут за',
  'Daily focus activity': 'Активность по дням',
  'Done · today / total': 'Выполнено · сегодня / всего',
  'Completed today / all time': 'Выполнено сегодня / за всё время',
  Accuracy: 'Точность',
  'Estimation accuracy, all time': 'Точность оценок за всё время',
  'Planned / actual': 'План / факт',
  'Latest 10 completions': 'Последние 10 завершений',
  Task: 'Задача',
  Planned: 'План',
  Actual: 'Факт',
  'By category': 'По категориям',
  'All time': 'За всё время',
  'No completed sessions yet.': 'Пока нет завершённых сессий.',
  'About data': 'О данных',
  'Time (min)': 'Время (мин)',
  'Break (min)': 'Перерыв (мин)',
  'Every (tasks)': 'Каждые (задач)',
  'Add a task to begin.': 'Добавьте задачу, чтобы начать.',
  'Plan session': 'Составить план',
  Cancel: 'Отмена',
  'Edit plan settings': 'Изменить параметры плана',
  Breaks: 'Перерывы',
  Free: 'Свободно',
  'min left': 'мин осталось',
  'Over time. Recalculate to reserve 5 more minutes.':
    'Время вышло. Пересчитайте план, чтобы добавить 5 минут.',
  completed: 'выполнено',
  '· Learned estimate': '· Уточнённая оценка',
  '· Completed': '· Выполнено',
  '· Deleted': '· Удалено',
  Focus: 'Фокус',
  'No tasks fit this budget.': 'Задачи не помещаются в отведённое время.',
  'Unscheduled ·': 'Вне плана ·',
  'Accept plan': 'Принять план',
  Discard: 'Отменить',
  Recalculate: 'Пересчитать',
  'Session schedule': 'Расписание сессии',
  Details: 'Подробности',
  'Priority first, then task order. Estimates leave your timer unchanged.':
    'Сначала приоритет, затем порядок задач. Оценки не изменяют таймер.',
  'Breaks are manual. Pauses use session time. Open Focus to start.':
    'Перерывы запускаются вручную. Паузы входят во время сессии. Откройте фокус для начала.',
  'Planning details': 'Подробности планирования',
  'Pause the current task in Focus Mode before switching.':
    'Приостановите текущую задачу в режиме фокуса перед переключением.',
  'Settings sections': 'Разделы настроек',
  'Type a task name, then press': 'Введите название и нажмите',
  Enter: 'Enter',
  'Estimated minutes': 'Время в минутах',
  Category: 'Категория',
  'Task category': 'Категория задачи',
  'Suggested:': 'Рекомендуется:',
  'min · Based on': 'мин · На основе',
  'completed sessions.': 'завершённых сессий.',
  'Use estimate': 'Использовать оценку',
  Priority: 'Приоритет',
  'Choose your details, then press': 'Выберите параметры и нажмите',
  Work: 'Работа',
  Study: 'Учёба',
  Personal: 'Личное',
  Health: 'Здоровье',
  Reading: 'Чтение',
  High: 'Высокий',
  Medium: 'Средний',
  Low: 'Низкий',
  'Drag to reorder; Arrow keys to move': 'Перетащите или используйте стрелки для изменения порядка',
  'Edit task': 'Изменить задачу',
  'Delete task': 'Удалить задачу',
  'Task list': 'Список задач',
  'Task title': 'Название задачи',
  'Task name': 'Название задачи',
  'Remembered tasks': 'Запомненные задачи',
  'Press Tab to complete:': 'Нажмите Tab для дополнения:',
  'Choose a remembered task, or forget it.': 'Выберите запомненную задачу или удалите её.',
  'Forget suggestion': 'Забыть задачу',
  'No remembered tasks.': 'Нет запомненных задач.',
  Lighting: 'Освещение',
  Applying: 'Применение',
  '✓ Active': '✓ Активна',
  'Applying your light…': 'Применяем тему…',
  'Your theme is saved on this device.': 'Тема сохранена на этом устройстве.',
  'Schedule needs review': 'План требует проверки',
  Settings: 'Настройки',
  'Workspace tools': 'Инструменты',
  'Open task list': 'Открыть список задач',
  Themes: 'Темы',
  Language: 'Язык',
  'Data & recovery': 'Данные и восстановление',
  Music: 'Музыка',
  Notifications: 'Уведомления',
  'In development': 'В разработке',
  'No tasks yet': 'Пока нет задач',
  'Saved on this device': 'Сохранено на этом устройстве',
  'Save changes': 'Сохранить изменения',
  'Save task': 'Сохранить задачу',
  Pause: 'Пауза',
  Start: 'Начать',
  Resume: 'Продолжить',
  'Ready · One thing at a time': 'Готово · Одна задача за раз',
  'Paused · Take your time': 'Пауза · Не торопитесь',
  'FocusFlow home': 'Главная FocusFlow',
  'Loading the latest workspace…': 'Загружаем актуальные данные…',
  'Give your task a title.': 'Введите название задачи.',
  'Choose a whole number from 1 to 1,440 minutes.': 'Введите целое число от 1 до 1440 минут.',
  'Choose a category.': 'Выберите категорию.',
  'Choose a priority.': 'Выберите приоритет.',
  'Reopen interface': 'Открыть интерфейс снова',
  'FocusFlow could not display this workspace': 'Не удалось отобразить рабочее пространство',
  'Your workspace data has not been cleared. Keep this tab open if saving has failed.':
    'Ваши данные не удалены. Не закрывайте вкладку, если сохранение не удалось.',
  'Running, paused and unfinished tasks are excluded. Weeks start Monday in your local timezone.':
    'Текущие, приостановленные и незавершённые задачи исключены. Неделя начинается в понедельник по местному времени.',
  'Unreliable, empty or duplicate observations are excluded.':
    'Недостоверные, пустые и повторные записи исключены.',
}
export function t<T>(value: T): T {
  if (typeof value !== 'string') return value
  const legacy: Record<string, string> = {
    'Настройки доступны только до перезагрузки.': 'Preferences are available until reload.',
    'Тема применена, но сохранить выбор не удалось.':
      'Theme applied, but your preference could not be saved.',
  }
  if (language.value !== 'ru') return (legacy[value] ?? value) as T
  if (value.startsWith('Read-only — ')) return ('Только чтение — ' + t(value.slice(12))) as T
  const text = value.trim()
  const translated = ru[text]
  if (translated) return value.replace(text, translated) as T
  for (const [pattern, replacement] of [
    [/^Close (.+)$/, 'Закрыть: '],
    [/^Focus on planned (.+)$/, 'Фокус по плану: '],
    [/^Focus on (.+)$/, 'Фокус: '],
    [/^Complete (.+)$/, 'Завершить: '],
    [/^Forget (.+)$/, 'Забыть: '],
    [/^Delete (.+)$/, 'Удалить: '],
    [/^Edit (.+)$/, 'Изменить: '],
  ] as const) {
    const match = text.match(pattern)
    if (match) return (replacement + (text.startsWith('Close ') ? t(match[1]!) : match[1]!)) as T
  }
  const reorder = text.match(/^Reorder (.+); use arrow keys$/)
  if (reorder) return `Переместить: ${reorder[1]}; используйте клавиши со стрелками` as T
  const priority = text.match(/^(.+) priority$/)
  if (priority) return `Приоритет: ${t(priority[1]!)}` as T
  if (text.endsWith(' min')) return value.replace(/ min$/, ' мин') as T
  return value
}
