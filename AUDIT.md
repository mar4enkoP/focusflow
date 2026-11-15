# FocusFlow technical audit — 2026-11-13

Последующие исправления Error Boundary, CSP, Undo и emergency export описаны в
[RELIABILITY.md](RELIABILITY.md). Таблица ниже фиксирует состояние исходного аудита;
перечисленные там соответствующие долги уже обработаны последующей реализацией.

Статусы отражают исследованный код, а не предположения предыдущего review.
Confirmed означает наличие недостатка, но не обязательно необходимость немедленного изменения.
Подтверждённых P0 при проведённых проверках не найдено.

| №   | Статус              | Вывод и решение                                                                                                                                                                                                                                                                                                                             |
| --- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | False positive      | `epoch` находится в workspace.ts; после await проверяются epoch, hidden и disposed. Координатор одноразовый; отмена отзывает доступ до release. Есть тест быстрых pagehide/pageshow и интеграционные тесты handoff.                                                                                                                         |
| 2   | False positive      | Detached subscribe/onAction снимаются через onScopeDispose; отдельный effectScope останавливается при потере ownership и dispose. startWorkspace возвращает cleanup.                                                                                                                                                                        |
| 3   | Partially confirmed | Ошибки чтения закрывают доступ, ошибки записи показывают notice; повреждённые snapshots не перезаписываются. Quota обработан общим обработчиком записи и проверяется integration-тестом. Несохранённые изменения остаются только в памяти и могут пропасть при закрытии/передаче ownership; нужен отдельный UX экспорта/повтора сохранения. |
| 4   | Partially confirmed | Store dependencies существуют, но задают реальные инварианты доступа, истории и таймера. Масштабная замена на orchestration layer сейчас увеличит риск миграций.                                                                                                                                                                            |
| 5   | Partially confirmed | Большая часть App.vue — стили; формы, список, timer и tools уже выделены. Lifecycle polling вынесен в useTimerPulse.                                                                                                                                                                                                                        |
| 6   | Confirmed           | Глобального Vue error boundary нет. Отдельная работа: определить восстановление после частично выполненной мутации. Слепой remount с сохранением состояния может повторить ошибку; общий catch без такого контракта не добавлялся.                                                                                                          |
| 7   | Partially confirmed | Computed кэшируются, оба обхода O(n); удалён лишний filter перед суммированием. Индексировать коллекцию без измерений не требуется.                                                                                                                                                                                                         |
| 8   | Confirmed           | Object.assign публиковал поля редактирования отдельно, синхронная подписка писала промежуточные snapshots. Исправлено атомарной заменой задачи. Flush sync оставлен для немедленного сохранения перед lifecycle release; обычные ticks уже не записываются.                                                                                 |
| 9   | Confirmed           | Interval работал постоянно. Теперь polling только при видимом активном измерении и canEdit; visibilitychange сверяет timestamp. Overtime после expiry сохранён.                                                                                                                                                                             |
| 10  | Partially confirmed | Runtime validation уже есть для задач, таймера, history, memory и plan. Timer validator теперь принимает unknown, проверяет tuple shape, session object и уникальность saved IDs. Ранее дубликаты молча схлопывались при restore в Map. Zod не нужен.                                                                                       |
| 11  | False positive      | В текущем timer.ts non-null assertions нет.                                                                                                                                                                                                                                                                                                 |
| 12  | False positive      | heading типизирован HTMLElement, callbacks получают типы Vue; unsafe DOM casts в App.vue не обнаружены.                                                                                                                                                                                                                                     |
| 13  | Confirmed           | Числовые литералы времени есть; refresh interval получил именованную константу. Общая унификация единиц времени — небольшой последующий cleanup.                                                                                                                                                                                            |
| 14  | Partially confirmed | Legacy v1 уже документирует запрет вывода фактической работы из countdown. Стоит дополнить отдельной таблицей схем и правил повреждения каждого ключа.                                                                                                                                                                                      |
| 15  | False positive      | canEdit и canMutate различаются разрешением синхронной hydration; hydrating — процесс, hydrated — готовность; ownsLock не означает готовность к редактированию. Это необходимые разные понятия.                                                                                                                                             |
| 16  | False positive      | Пользовательские заголовки выводятся Vue interpolation; v-html/innerHTML в src не найдены.                                                                                                                                                                                                                                                  |
| 17  | Needs investigation | В index.html CSP нет; HTTP headers хостинга не доступны в репозитории. Нужна проверка deployment headers. Строгую CSP следует проверять с динамическими Vue styles, canvas и dev tooling; отсутствие meta само по себе не доказательство XSS.                                                                                               |
| 18  | False positive      | Установлен TypeScript 6.0.3; type-check/build проходят. TS 6 является stable release, см. официальный анонс: https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/ .                                                                                                                                                         |
| 19  | False positive      | package-lock.json есть; CI использует npm ci и запускает typecheck, tests, linters, formatting, build и Chromium E2E. Node 24 и ubuntu-latest не фиксируют окружение побитно.                                                                                                                                                               |
| 20  | Partially confirmed | Уже есть 8 E2E для задач, timer/reload, storage и multi-tab. Отдельный browser flow смены тем стоит добавить. В этом окружении отсутствует Playwright Chromium, поэтому E2E не подтверждены выполнением.                                                                                                                                    |
| 21  | False positive      | Есть workspaceIntegration, clockRecovery, timer, persistence tests: ownership handoff, quota, повреждение, rollback, expiry, восстановление.                                                                                                                                                                                                |
| 22  | Partially confirmed | Есть автоматические keyboard/focus/ARIA проверки компонентов; специализированного accessibility scan нет. Следующий шаг — браузерная проверка контраста и accessibility tree, затем обоснованное добавление axe.                                                                                                                            |
| 23  | False positive      | App показывает Loading the latest workspace, editing заблокирован до hydration. Hydration синхронна и обычно не занимает отдельный кадр.                                                                                                                                                                                                    |
| 24  | False positive      | Основные данные и workflow локальны; индикатор offline не меняет доступность основных действий.                                                                                                                                                                                                                                             |
| 25  | Confirmed           | Undo удаления отсутствует. Это дополнительная UX-функция P2, требующая восстановления history/timer, а не только возврата строки задачи. Не добавлялась в reliability patch.                                                                                                                                                                |

## Внесённые изменения

- `src/stores/tasks.ts`: атомарное редактирование и отсутствие временного массива при подсчёте минут.
- `src/persistence.ts`: защитная проверка вложенных timer entries и запрет неоднозначных дубликатов IDs; повреждённый raw snapshot сохраняется.
- `src/composables/useTimerPulse.ts`, `src/App.vue`: lifecycle polling, cleanup и reconciliation при возвращении во вкладку.
- `src/__tests__/persistence.spec.ts`: проверка единственной полной записи edit и сохранения повреждённого timer snapshot.
- `src/__tests__/timerPulse.spec.ts`: idle/running/hidden/return/expiry/overtime/pause/ownership loss/unmount.

Существующие пользовательские изменения в компонентах, appearance и visuals сохранены.
Зависимости, формат хранения и визуальные стили аудитом не менялись; commits не создавались.

## Проверки

- До изменений: unit/integration — 158 passed.
- После изменений: unit/integration — 163 passed, 16 файлов.
- Production build (включая vue-tsc) — passed.
- Prettier для изменённых файлов — passed.
- Проверка linters всего проекта выявила две ошибки require-mock-type-parameters в существующем пользовательском `src/__tests__/appearance.spec.ts:10,11` (Oxlint). Выборочный ESLint изменённых файлов прошёл.
- E2E: все 8 сценариев не смогли запустить браузер, executable chromium_headless_shell-1254 отсутствует. Это не успешное прохождение сценариев.

## Следующие приоритеты

1. UX сохранения при quota: явный повтор/экспорт несохранённого workspace перед закрытием или handoff; нельзя обещать durability после отказа storage.
2. Error boundary с видимым сообщением, диагностикой и явным восстановлением без очистки пользовательских snapshots.
3. Выполнить Chromium E2E в подготовленном окружении и добавить смену тем; отдельно проверить deployment CSP и accessibility/contrast.
4. После измерений на большой коллекции решить, нужен ли action-level batching остальных синхронных записей. Debounce без flush перед release способен потерять последние изменения.
