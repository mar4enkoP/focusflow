<script setup lang="ts">
defineProps<{ compact: boolean }>()
</script>

<template>
  <div class="welcome-intro" :class="{ expanded: !compact }">
    <Transition name="heading" mode="out-in">
      <h1 v-if="compact" key="welcome" id="creation-title">
        <span class="line-mask"><span>A little focus.</span></span>
        <span class="line-mask"><span>Start with one task.</span></span>
      </h1>
    </Transition>
  </div>
</template>

<style scoped lang="scss">
.welcome-intro {
  pointer-events: none;
}
h1 {
  position: absolute;
  top: 48px;
  left: 0;
  width: 100%;
  margin: 0;
  color: var(--text);
  text-align: center;
  font-size: clamp(23px, 4vw, 28px);
  line-height: 1.3;
  font-weight: 400;
  letter-spacing: -0.8px;
  transition:
    opacity 180ms ease,
    transform 300ms ease;
}
.line-mask {
  display: block;
  overflow: hidden;
  > span {
    display: block;
    animation: line-in 750ms cubic-bezier(0.256, 0.009, 0.125, 0.997) 520ms both;
  }
  &:nth-child(2) > span {
    animation-delay: 610ms;
  }
}
.heading-leave-active {
  transition:
    opacity 180ms ease,
    transform 180ms ease;
}
.heading-leave-to {
  opacity: 0;
  transform: translateY(-12px);
}
.details-title {
  top: 8px;
  font-size: 23px;
  letter-spacing: -0.6px;
  .line-mask > span {
    animation-delay: 650ms;
    animation-duration: 600ms;
  }
}
@keyframes line-in {
  from {
    transform: translateY(150%);
  }
  to {
    transform: translateY(0);
  }
}
@media (prefers-reduced-motion: reduce) {
  .line-mask > span,
  h1 {
    animation: none;
    transition: none;
  }
}
</style>
