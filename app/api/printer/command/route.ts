import { NextRequest, NextResponse } from 'next/server';
import {
  OctoPrintCommand,
  OctoPrintError,
  sendOctoPrintCommand,
} from '@/app/lib/octoprint';
import {
  ControlAuthConfigError,
  isControlSessionValid,
} from '@/app/lib/control-auth';

const commands = new Set<OctoPrintCommand>(['pause', 'resume', 'cancel']);

export async function POST(request: NextRequest) {
  try {
    if (!(await isControlSessionValid(request))) {
      return NextResponse.json({ error: 'Control authentication required' }, { status: 401 });
    }
  } catch (error) {
    if (error instanceof ControlAuthConfigError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return NextResponse.json({ error: 'Unable to verify control session' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 });
  }

  if (
    typeof body !== 'object' ||
    body === null ||
    Array.isArray(body) ||
    !('command' in body) ||
    typeof body.command !== 'string' ||
    !commands.has(body.command as OctoPrintCommand) ||
    Object.keys(body).length !== 1
  ) {
    return NextResponse.json(
      { error: 'Command must be pause, resume, or cancel' },
      { status: 400 },
    );
  }

  try {
    await sendOctoPrintCommand(body.command as OctoPrintCommand);
    return new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof OctoPrintError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Unable to send printer command' }, { status: 502 });
  }
}
