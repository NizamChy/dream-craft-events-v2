"use client";

import { PageHeading } from "@/components/dashboard/page-heading";
import { EventForm } from "@/components/dashboard/organizer/event-form";

export default function NewEventPage() {
  return (
    <>
      <PageHeading title="Create an event" description="Fill in the details below. You can save it as a draft and publish later." />
      <EventForm />
    </>
  );
}
