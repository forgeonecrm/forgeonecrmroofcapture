import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Job } from "./types";
import { repairLegacyPitchDegrees } from "./geometry";

type PatchOptions = { keepReview?: boolean };

type PipelineState = {
  jobs: Job[];
  selectedId: string | null;
  hydrated: boolean;
  setHydrated: (value: boolean) => void;
  select: (id: string | null) => void;
  upsertMeasured: (job: Job) => void;
  patch: (id: string, recipe: (job: Job) => Job, options?: PatchOptions) => void;
  remove: (id: string) => void;
};

function purgeCoordinates(job: Job): Job {
  if (!job.coordinates) return job;
  if (new Date(job.coordinates.expiresAt).getTime() > Date.now()) return job;
  return {
    ...job,
    coordinates: null,
    diagnostics: [
      ...job.diagnostics,
      {
        at: new Date().toISOString(),
        level: "info",
        service: "CACHE",
        message:
          "Coordinates removed after the 30-day limit. The Place ID was kept. Measure the address again to refresh the pin.",
      },
    ],
  };
}

function repairJob(job: Job): Job {
  const purged = purgeCoordinates(job);
  return {
    ...purged,
    planes: purged.planes.map((plane) => {
      const pitchDegrees = repairLegacyPitchDegrees(plane.pitchDegrees, plane.pitchSource);
      if (pitchDegrees === plane.pitchDegrees) return plane;
      return { ...plane, pitchDegrees };
    }),
  };
}

const memoryStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

export const usePipeline = create<PipelineState>()(
  persist(
    (set) => ({
      jobs: [],
      selectedId: null,
      hydrated: false,
      setHydrated: (hydrated) => set({ hydrated }),
      select: (selectedId) => set({ selectedId }),
      upsertMeasured: (incoming) =>
        set((state) => {
          const prev = state.jobs.find((job) => job.placeId && job.placeId === incoming.placeId);
          if (!prev) {
            return { jobs: [incoming, ...state.jobs], selectedId: incoming.id };
          }
          const merged: Job = {
            ...incoming,
            id: prev.id,
            createdAt: prev.createdAt,
            planes: [...incoming.planes, ...prev.planes.filter((plane) => plane.origin === "MANUAL")],
            edges: prev.edges,
            existingSolar: prev.existingSolar,
            prices: prev.prices,
            review: { checked: false, verifiedAt: null },
          };
          return {
            selectedId: prev.id,
            jobs: state.jobs.map((job) => (job.id === prev.id ? merged : job)),
          };
        }),
      patch: (id, recipe, options) =>
        set((state) => ({
          jobs: state.jobs.map((job) => {
            if (job.id !== id) return job;
            const next = recipe(job);
            return {
              ...next,
              updatedAt: new Date().toISOString(),
              review: options?.keepReview ? next.review : { checked: false, verifiedAt: null },
            };
          }),
        })),
      remove: (id) =>
        set((state) => ({
          jobs: state.jobs.filter((job) => job.id !== id),
          selectedId: state.selectedId === id ? null : state.selectedId,
        })),
    }),
    {
      name: "forgeone-roof-pipeline-v1",
      storage: createJSONStorage(() => (typeof window === "undefined" ? memoryStorage : localStorage)),
      skipHydration: true,
      partialize: (state) => ({ jobs: state.jobs, selectedId: state.selectedId }),
    },
  ),
);

export async function hydratePipeline(): Promise<void> {
  await usePipeline.persist.rehydrate();
  usePipeline.setState((state) => ({
    jobs: state.jobs.map(repairJob),
    hydrated: true,
  }));
}
