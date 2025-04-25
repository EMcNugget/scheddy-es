import { loadUserData } from '$lib/userInfo';
import { roleOf } from '$lib';
import { ROLE_MENTOR, ROLE_STAFF } from '$lib/utils';
import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { mentors, sessions, sessionTypes, students } from '$lib/server/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies }) => {
	const { user } = (await loadUserData(cookies))!;
	if (roleOf(user) < ROLE_MENTOR) {
		redirect(307, '/schedule');
	}

	const validTypes = await db.select().from(sessionTypes);

	const typesMap: Record<string, string> = {};
	for (const typ of validTypes) {
		typesMap[typ.id] = typ.name;
	}

	const query = db
		.select()
		.from(sessions)
		.leftJoin(students, eq(students.id, sessions.student))
		.leftJoin(mentors, eq(mentors.id, sessions.mentor))
		.leftJoin(sessionTypes, eq(sessionTypes.id, sessions.type))
		.orderBy(desc(sessions.start));

	if (roleOf(user) < ROLE_STAFF) {
		query.where(and(eq(mentors.id, user.id), eq(sessions.cancelled, true)));
	} else {
		query.where(eq(sessions.cancelled, true));
	}

	return {
		user,
		mentorSessions: await query,
		typesMap,
		breadcrumbs: [
			{ title: 'Dashboard', url: '/dash' },
			{ title: 'Facility Calendar', url: '/dash/cal' },
			{ title: 'Cancelled Sessions' }
		]
	};
};
