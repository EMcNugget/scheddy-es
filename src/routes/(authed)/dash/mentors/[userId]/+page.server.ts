import { loadUserData } from '$lib/userInfo';
import { roleOf } from '$lib';
import { ROLE_STAFF } from '$lib/utils';
import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { sessions, sessionTypes, students, mentors, users } from '$lib/server/db/schema';
import { eq, and, gte, asc } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import type { MentorAvailability } from '$lib/availability';
import { DateTime } from 'luxon';

export const load: PageServerLoad = async ({ cookies, params }) => {
	const { user } = (await loadUserData(cookies))!;
	if (roleOf(user) < ROLE_STAFF && user.id != params.userId) {
		redirect(307, '/schedule');
	}

	const mentor = await db
		.select()
		.from(users)
		.where(eq(users.id, Number.parseInt(params.userId!)));

	if (!mentor || mentor.length === 0) {
		redirect(307, '/dash');
	}

	const validTypes = await db.select().from(sessionTypes);

	const typesMap: Record<string, string> = {};
	for (const typ of validTypes) {
		typesMap[typ.id] = typ.name;
	}

	const avail: MentorAvailability | null = mentor[0].mentorAvailability
		? JSON.parse(mentor[0].mentorAvailability)
		: null;
	const allowedTypes: string[] | null = mentor[0].allowedSessionTypes
		? JSON.parse(mentor[0].allowedSessionTypes)
		: null;
	const bookableTypes: string[] | null = mentor[0].bookableSessionTypes
		? JSON.parse(mentor[0].bookableSessionTypes)
		: null;

	const now = DateTime.utc();

	const mentorSessions = await db
		.select()
		.from(sessions)
		.leftJoin(students, eq(students.id, sessions.student))
		.leftJoin(mentors, eq(mentors.id, sessions.mentor))
		.leftJoin(sessionTypes, eq(sessionTypes.id, sessions.type))
		.where(
			and(
				eq(sessions.mentor, mentor[0].id),
				eq(sessions.cancelled, false),
				gte(sessions.start, now.toISO())
			)
		)
		.orderBy(asc(sessions.start));

	let ex_changed = false;

	if (avail?.exceptions) {
		for (const ex in avail.exceptions) {
			const ex_date = DateTime.fromISO(ex).setZone(mentor[0].timezone).set({
				hour: avail.exceptions[ex].start.hour,
				minute: avail.exceptions[ex].start.minute
			});

			const time_now = DateTime.now();

			if (ex_date < time_now) {
				delete avail.exceptions[ex];
				ex_changed = true;
			}
		}
	}

	if (ex_changed) {
		await db
			.update(users)
			.set({
				mentorAvailability: JSON.stringify(avail)
			})
			.where(eq(users.id, Number.parseInt(params.userId!)));
	}

	return {
		user,
		mentor: mentor[0],
		availability: avail,
		allowedTypes,
		bookableTypes,
		typesMap,
		mentorSessions,
		breadcrumbs:
			user.id === mentor[0].id
				? [{ title: 'Dashboard', url: '/dash' }, { title: 'My Schedule' }]
				: [
						{ title: 'Dashboard', url: '/dash' },
						{ title: 'Mentors', url: '/dash/mentors' },
						{ title: mentor[0].firstName + ' ' + mentor[0].lastName }
					]
	};
};
