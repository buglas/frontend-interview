<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { getQuestion, questionsByGroup } from "@/content/catalog";
import { labComponent } from "@/labs/registry";
import { loadDone, saveDone } from "@/content/progress";

const route = useRoute();
const router = useRouter();
const groups = questionsByGroup();
const id = computed(() => String(route.params.id ?? "A1"));
const q = computed(() => getQuestion(id.value));
const view = computed(() => labComponent(id.value));
const done = ref<string[]>(loadDone());
const codeOpen = ref(true);

watch(id, () => {
  codeOpen.value = true;
});

function isDone(qid: string) {
  return done.value.includes(qid);
}

function toggleDone(qid: string) {
  const set = new Set(done.value);
  if (set.has(qid)) set.delete(qid);
  else set.add(qid);
  done.value = [...set];
  saveDone(done.value);
}

function go(qid: string) {
  router.push({ name: "lab", params: { id: qid } });
}
</script>

<template>
  <div class="shell">
    <header class="top">
      <div>
        <strong>多模态可视化面试实验室</strong>
        <span class="sub">MapLibre · 示意数据非真实采集</span>
      </div>
    </header>
    <div class="body">
      <aside class="nav">
        <section v-for="g in groups" :key="g.group">
          <h3>{{ g.label }}</h3>
          <div
            v-for="item in g.items"
            :key="item.id"
            class="nav-item"
            :class="{ active: item.id === id }"
          >
            <input
              type="checkbox"
              :checked="isDone(item.id)"
              :aria-label="'标记已练 ' + item.id"
              @click.stop
              @change="toggleDone(item.id)"
            />
            <button type="button" class="nav-item-go" @click="go(item.id)">
              <span class="qid">{{ item.id }}</span>
              <span class="qtitle">{{ item.title }}</span>
              <span class="tag" :class="item.hasDemo ? 'demo' : 'read'">{{
                item.hasDemo ? "演示" : "图文"
              }}</span>
            </button>
          </div>
        </section>
      </aside>
      <main class="stage">
        <component :is="view" :key="id" />
      </main>
      <aside v-if="q" class="panel">
        <p class="badge">{{ q.id }} · {{ q.hasDemo ? "场景演示" : "图文课" }}</p>
        <h2>{{ q.title }}</h2>
        <p class="summary">{{ q.summary }}</p>
        <h3>考点 / 翻车</h3>
        <ul>
          <li v-for="p in q.points" :key="p">{{ p }}</li>
        </ul>
        <template v-if="q.code">
          <button type="button" class="linkish" @click="codeOpen = !codeOpen">
            {{ codeOpen ? "收起代码" : "关键代码" }}
          </button>
          <pre v-show="codeOpen" class="code">{{ q.code }}</pre>
        </template>
        <p class="hint">完整答法（30 秒 / 原理 / 深挖）见根目录手册。</p>
      </aside>
    </div>
  </div>
</template>
