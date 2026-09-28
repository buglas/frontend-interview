import { createRouter, createWebHistory } from "vue-router";
import LabShell from "@/labs/shared/LabShell.vue";
import { getQuestion } from "@/content/catalog";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", redirect: "/labs/A1" },
    {
      path: "/labs/:id",
      name: "lab",
      component: LabShell,
      beforeEnter(to) {
        const id = String(to.params.id);
        if (!getQuestion(id)) return { name: "lab", params: { id: "A1" } };
      },
    },
  ],
});
