-- Students could not see a test until the second it started.
--
-- "tests_select_visible" gated a student's SELECT behind is_test_live(), which is only
-- true once scheduled_at <= now(). A scheduled test was therefore invisible to the batch
-- until it went live: the "Upcoming" sections on /student and /student/tests could never
-- populate, so scheduling appeared to do nothing.
--
-- Visibility of the test ROW (title, time, duration) is not the same as access to its
-- QUESTIONS. Questions are still served only through get_student_test_questions(), which
-- keeps its is_test_live() check, and test_submissions inserts still require is_test_live().
-- Neither is touched here.
drop policy if exists "tests_select_visible" on public.tests;
create policy "tests_select_visible" on public.tests
for select using (
  public.is_test_teacher(id)
  or public.is_test_student(id)
);
