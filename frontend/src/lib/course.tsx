"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { loadClassConfiguration } from "@/lib/lms";

interface CourseContextValue {
  code: string;
  title: string;
  term: string;
  timezone: string;
}

const browserTimezone = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

let activeTimezone = "UTC";
export const courseTimezone = () => activeTimezone;

const CourseContext = createContext<CourseContextValue>({
  code: "",
  title: "",
  term: "",
  timezone: "UTC",
});

export function CourseProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const [course, setCourse] = useState<CourseContextValue>({
    code: "",
    title: "",
    term: "",
    timezone: browserTimezone(),
  });

  useEffect(() => {
    activeTimezone = course.timezone;
  }, [course.timezone]);

  useEffect(() => {
    if (!session) return;
    let current = true;
    loadClassConfiguration().then((result) => {
      if (!current || !result.class) return;
      const next = {
        code: result.class.code,
        title: result.class.title,
        term: result.class.term,
        timezone: result.class.timezone,
      };
      activeTimezone = next.timezone;
      setCourse(next);
    });
    return () => {
      current = false;
    };
  }, [session]);

  return (
    <CourseContext.Provider value={course}>{children}</CourseContext.Provider>
  );
}

export const useCourse = () => useContext(CourseContext);
