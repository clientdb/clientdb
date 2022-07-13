import { runInAction } from "mobx";
import { assert } from "./assert";

import { IS_DEV } from "./dev";
import { ResolvablePromise, wait, createResolvablePromise } from "./promises";

type Task<T> = () => T;

const DEV_ARTIFICIAL_DELAY = 0;

/**
 * Will create queue of async tasks.
 *
 * Assumptions:
 * They're guaranteed to be executed in order of being added.
 * Next task will never get executed before previous was successfully executed.
 */
export function createPushQueue() {
  const queue = new Set<Task<unknown>>();
  /**
   * ".add" returns a promise of 'when will this task be completed'. As it is different promise to task itself, we need to keep track of it.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const taskFlushedPromisesMap = new WeakMap<
    Task<unknown>,
    ResolvablePromise<any>
  >();

  // TODO: Let's discuss scenario of failed attempts - should we replay?

  // Make sure we never have multiple flushing at once.
  let isFlushing = false;

  /**
   * If one task in queue failed - reject all pending tasks.
   *
   * We start rejecting in reverse order (starting from last added).
   *
   * eg. if you add topic, then message - if topic fails > we first reject (and undo) adding message and then topic.
   *
   * In a way like CMD+Z undo works - you first undo last actions.
   */
  function rejectAllAndReset(
    failedTask: Task<unknown>,
    failedTaskError: unknown
  ) {
    const tasksFromNewest = Array.from(queue).reverse();

    // Run in action so all fails are flushed to UI at once.
    runInAction(() => {
      for (const taskToReject of tasksFromNewest) {
        const taskPromise = taskFlushedPromisesMap.get(taskToReject);
        assert(taskPromise, "Incorrect state - no task promise");

        queue.delete(taskToReject);

        if (taskToReject === failedTask) {
          taskPromise.reject(failedTaskError);
        } else {
          taskPromise.reject(new Error(`Previous task in queue failed`));
        }
      }
    });
  }

  async function flushNext() {
    if (isFlushing) return;
    const [nextTask] = Array.from(queue);

    if (!nextTask) return;

    isFlushing = true;

    // Get resolvable promise of original call waiting for this task to be resolved.
    const flushPromise = taskFlushedPromisesMap.get(nextTask);

    assert(flushPromise, "No flush promise for task added");

    try {
      if (IS_DEV && DEV_ARTIFICIAL_DELAY > 0) {
        await wait(DEV_ARTIFICIAL_DELAY);
      }

      // Try to execute
      const result = await nextTask();
      // Only if successful - delete task for queue to allow next tasks to be executed.
      queue.delete(nextTask);
      flushPromise.resolve(result);
      scheduleNext();
    } catch (error) {
      rejectAllAndReset(nextTask, error);
    } finally {
      isFlushing = false;
    }
  }

  function scheduleNext() {
    setTimeout(() => flushNext(), 0);
  }

  async function add<T>(task: Task<T>) {
    queue.add(task);
    const flushPromise = createResolvablePromise<T>();
    taskFlushedPromisesMap.set(task, flushPromise);

    scheduleNext();

    return flushPromise.promise;
  }

  async function waitForFlush() {
    const allPromises = Array.from(queue).map((task) => {
      return taskFlushedPromisesMap.get(task)?.promise;
    });

    await Promise.all(
      allPromises.map(async (promise) => {
        try {
          await promise;
        } catch {
          //
        }
      })
    );
  }

  return {
    add,
    waitForFlush,
  };
}
