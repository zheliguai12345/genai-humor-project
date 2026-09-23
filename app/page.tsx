import { supabase } from "@/utils/supabase/client";

export default async function Home() {
  const { data: tasks, error } = await supabase
      .from("tasks")
      .select("*");

  console.log(tasks);
  console.log(error);

return (
    <main>
        <h1>Tasks</h1>

        <ul>
            {tasks?.map((task) => (
                <li key={task.id}>{task.title}</li>
            ))}
        </ul>
    </main>
);
}