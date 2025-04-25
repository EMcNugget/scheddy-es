import { db } from '$lib/server/db';
import { sessions, sessionTypes, students, mentors } from '$lib/server/db/schema';
import { and, eq, gte } from 'drizzle-orm';
import { DateTime } from 'luxon';
import { sendEmail } from '$lib/email';
import { reminder } from '$lib/emails/student/reminder';
import { serverConfig } from '$lib/config/server';

export async function GET() {
	const sessWithin24h = await db
		.select()
		.from(sessions)
		.leftJoin(mentors, eq(mentors.id, sessions.mentor))
		.leftJoin(students, eq(students.id, sessions.student))
		.leftJoin(sessionTypes, eq(sessionTypes.id, sessions.type))
		.where(
			and(
				eq(sessions.reminded, false),
				eq(sessions.cancelled, false),
				gte(sessions.start, DateTime.now().minus({ hours: 24 }).toISO())
			)
		);

	for (const sess of sessWithin24h) {
		const studentEmailContent = reminder({
			startTime: DateTime.fromISO(sess.session.start).setZone(sess.session.timezone),
			timezone: sess.session.timezone,
			sessionId: sess.session.id,
			type: sess.sessionType.name,
			mentorName: sess.mentor.firstName + ' ' + sess.mentor.lastName,
			facilityName: serverConfig.facility.name_public,
			emailDomain: serverConfig.facility.mail_domain
		});

		await sendEmail(
			sess.student.email,
			'Session reminder - ' +
				DateTime.fromISO(sess.session.start)
					.setZone(sess.session.timezone)
					.toLocaleString(DateTime.DATETIME_HUGE),
			studentEmailContent.raw,
			studentEmailContent.html
		);

		await db
			.update(sessions)
			.set({
				reminded: true
			})
			.where(eq(sessions.id, sess.session.id));
	}

	console.log('[sendReminderEmails] Sent ' + sessWithin24h.length + ' reminder emails');

	return new Response(JSON.stringify({ ok: true }));
}
