<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import AppIcon from './AppIcon.vue'
import { summarize } from '@/analytics'
import { useFocusHistoryStore } from '@/stores/focusHistory'
const section = ref<'overview' | 'sessions'>('overview')
const weekday = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString('en', { weekday: 'short' })
const history = useFocusHistoryStore()
const now = ref(Date.now())
let pulse: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  pulse = setInterval(() => {
    now.value = Date.now()
  }, 30000)
})
onUnmounted(() => clearInterval(pulse))
const data = computed(() => summarize(history.observations, now.value))
const max = computed(() => Math.max(60000, ...data.value.days.map((d) => d.ms)))
const minutes = (ms: number) => (ms / 60000).toFixed(1).replace(/\.0$/, '')
</script>
<template>
  <div>
    <div class="segments" role="group" aria-label="Analytics view">
      <button type="button" :aria-pressed="section === 'overview'" @click="section = 'overview'">
        Overview
      </button>
      <button type="button" :aria-pressed="section === 'sessions'" @click="section = 'sessions'">
        Sessions
      </button>
    </div>
    <template v-if="section === 'overview'">
      <dl class="metrics">
        <div class="metric">
          <dt class="metric-label">Focus today</dt>
          <dd class="metric-value">{{ minutes(data.todayMs) }} <small>min</small></dd>
        </div>
        <div class="metric">
          <dt class="metric-label">This week</dt>
          <dd class="metric-value">{{ minutes(data.weekMs) }} <small>min</small></dd>
        </div>
      </dl>
      <div class="section-heading">
        <h3>Last 7 days</h3>
      </div>
      <ul class="activity" aria-label="Daily focus activity">
        <li
          v-for="day in data.days"
          :key="day.date"
          :title="day.date + ': ' + minutes(day.ms) + ' min'"
          :class="{ today: day.date === data.days[data.days.length - 1]?.date }"
        >
          <span class="chart-value"
            >{{ minutes(day.ms) }}<span class="sr-only"> minutes on {{ day.date }}</span></span
          >
          <span class="bar" aria-hidden="true"
            ><i :style="{ height: (day.ms / max) * 100 + '%' }"
          /></span>
          <span class="day-label">{{ weekday(day.date) }}</span>
        </li>
      </ul>
      <div class="secondary-metrics">
        <div>
          <span class="metric-label" title="Completed today / all time">Done · today / total</span
          ><strong
            >{{ data.completedToday }} <span>/ {{ data.completed }}</span></strong
          >
        </div>
        <div>
          <span class="metric-label" title="Estimation accuracy, all time">Accuracy</span
          ><strong>{{
            data.accuracy === undefined ? '—' : Math.round(data.accuracy) + '%'
          }}</strong>
        </div>
      </div>
    </template>
    <template v-else>
      <div class="section-heading">
        <h3>Planned / actual</h3>
        <small>Latest 10 completions</small>
      </div>
      <div v-if="data.records.length" class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Task</th>
              <th>Planned</th>
              <th>Actual</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="record in [...data.records]
                .sort((a, b) => b.completedAt - a.completedAt)
                .slice(0, 10)"
              :key="record.sessionId"
            >
              <td>
                <span class="record-title"
                  ><AppIcon :name="record.category ?? 'layers'" />{{ record.title }}</span
                >
              </td>
              <td>{{ record.plannedMinutes }} min</td>
              <td>{{ minutes(record.actualMs) }} min</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
    <template v-if="section === 'sessions'">
      <template v-if="data.records.length">
        <div class="section-heading">
          <h3>By category</h3>
          <small>All time</small>
        </div>
        <ul class="categories">
          <li v-for="category in data.categories" :key="category.name">
            <AppIcon
              :name="category.name.startsWith('Unknown') ? 'layers' : category.name"
            /><span>{{ category.name }}</span
            ><small>{{ minutes(category.ms) }} min</small>
          </li>
        </ul>
      </template>
    </template>
    <p v-if="!data.records.length" class="empty-state">No completed sessions yet.</p>
    <details v-if="section === 'sessions'" class="method">
      <summary>About data</summary>
      <p>
        Running, paused and unfinished tasks are excluded. Weeks start Monday in your local
        timezone.
      </p>
      <p>
        Accuracy = 100% minus mean absolute percentage error versus actual time, floored at 0%.
        Sessions under one minute are excluded from accuracy. It is a historical comparison, not a
        prediction guarantee.
      </p>
      <p v-if="data.legacy">
        {{ data.legacy }} older records lack complete timing intervals: unlocated focus is assigned
        to the completion date. Missing categories remain unknown.
      </p>
      <p v-if="data.excluded">Unreliable, empty or duplicate observations are excluded.</p>
    </details>
  </div>
</template>
<style scoped lang="scss">
@use '@/assets/workspace' as workspace;
@include workspace.content;
.segments {
  display: flex;
  padding: 3px;
  border: 1px solid var(--glass-edge);
  border-radius: 18px;
  background: var(--glass-fill);
  button {
    flex: 1;
    height: 28px;
    border: 0;
    color: var(--muted);
    font-size: 12px;
    background: transparent;
    &[aria-pressed='true'] {
      background: #ffffff12;
      box-shadow: inset 0 1px 0 #ffffff10;
      color: var(--text);
    }
  }
}
.metrics {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin: 14px 0 0;
}
.activity {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 12px;
  margin: 0;
  padding: 0 4px 18px;
  list-style: none;
  li {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 0;
    gap: 8px;
  }
  .chart-value {
    color: var(--muted);
    font-size: 10px;
    font-variant-numeric: tabular-nums;
  }
  .bar {
    height: 70px;
    width: min(26px, 100%);
    display: flex;
    align-items: flex-end;
    border-bottom: 1px solid #ffffff14;
  }
  i {
    display: block;
    width: 100%;
    border-radius: 5px 5px 3px 3px;
    background: linear-gradient(180deg, #79737c, #2b262e);
    box-shadow: inset 0 1px 0 #ffffff18;
  }
  .today i {
    background: linear-gradient(180deg, #eee9f0, #726b76);
  }
  .day-label {
    font-size: 11px;
    color: var(--muted);
  }
}
.secondary-metrics {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  border-top: 1px solid var(--glass-edge);
  padding-top: 16px;
  strong {
    display: block;
    font-size: 19px;
    font-weight: 350;
    margin-top: 7px;
    span {
      color: var(--muted);
      font-size: 12px;
    }
  }
}
.categories {
  list-style: none;
  padding: 0;
  margin: 0;
  li {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 4px;
    border-bottom: 1px solid #ffffff05;
    font-size: 12px;
    > span {
      flex: 1;
    }
    svg {
      color: var(--muted);
    }
  }
}
.scope {
  margin: 18px 0 0;
  font-size: 10px;
  color: var(--muted);
}
.table-scroll {
  overflow: auto;
}
table {
  border-collapse: collapse;
  width: 100%;
  font-size: 11px;
  text-align: left;
}
th,
td {
  padding: 12px 4px;
  border-bottom: 1px solid var(--glass-edge);
}
th {
  font-weight: 400;
  color: var(--muted);
}
td:not(:first-child) {
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.record-title {
  display: flex;
  align-items: center;
  gap: 8px;
  overflow-wrap: anywhere;
  svg {
    flex-shrink: 0;
    color: var(--muted);
  }
}
@media (max-width: 380px) {
  .activity {
    gap: 6px;
  }
  .metric {
    padding: 12px;
  }
}
</style>
