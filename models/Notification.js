import mongoose from 'mongoose'

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
    },
    type: {
      type: String,
      enum: [
        'lead_assigned',
        'lead_updated',
        'follow_up_reminder',
        'booking_confirmed',
        'payment_received',
        'payment_overdue',
        'tour_started',
        'team_invitation',
        'employee_approval_requested',
        'employee_approved',
        'employee_rejected',
        'message',
        'system',
      ],
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    },
    relatedId: {
      type: mongoose.Schema.Types.ObjectId, // Reference to Lead, Booking, etc.
    },
    relatedModel: {
      type: String, // Lead, Booking, FollowUp, etc.
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    readAt: {
      type: Date,
    },
    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'urgent'],
      default: 'normal',
    },
    channels: {
      inApp: { type: Boolean, default: true },
      email: { type: Boolean, default: false },
      sms: { type: Boolean, default: false },
    },
    action: {
      type: {
        text: String,
        link: String,
      },
    },
  },
  { timestamps: true }
)

// Index for faster queries
notificationSchema.index({ userId: 1, createdAt: -1 })
notificationSchema.index({ userId: 1, isRead: 1 })

export default mongoose.models.Notification || mongoose.model('Notification', notificationSchema)
