import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "wedding-photo-app",
  name: "Wedding Photo App",
  checkpointing: {
    maxRuntime: "240s",
  },
});
