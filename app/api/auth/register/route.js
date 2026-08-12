/**
 * Public signup is disabled — agencies are now provisioned by a super admin
 * (POST /api/superadmin/agencies), typically after reviewing a "Book a Demo"
 * request. This endpoint stays only to return a clear error instead of a 404.
 */
export async function POST() {
  return Response.json(
    { error: 'Public sign-up is disabled. Please book a demo and our team will set up your workspace.' },
    { status: 403 }
  )
}
