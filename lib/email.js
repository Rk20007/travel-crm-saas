import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'your-email@gmail.com',
    pass: process.env.EMAIL_PASS || 'your-app-password',
  },
})

export async function sendOTPEmail(email, otp) {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Your Travel CRM OTP Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Email Verification</h2>
          <p>Your OTP code is:</p>
          <h1 style="color: #0B1C2D; font-size: 32px; letter-spacing: 5px;">${otp}</h1>
          <p>This code will expire in 10 minutes.</p>
          <p style="color: #666; font-size: 12px;">If you didn't request this code, please ignore this email.</p>
        </div>
      `,
    })
    return true
  } catch (error) {
    console.error('Email send error:', error)
    return false
  }
}

export async function sendWelcomeEmail(email, name) {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Welcome to Travel CRM',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Welcome, ${name}!</h2>
          <p>Your account has been created successfully.</p>
          <p>You can now login to your Travel CRM dashboard and start managing your travel business.</p>
          <a href="${process.env.APP_URL}/login" style="display: inline-block; background-color: #0B1C2D; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; margin-top: 20px;">Login to Dashboard</a>
        </div>
      `,
    })
    return true
  } catch (error) {
    console.error('Email send error:', error)
    return false
  }
}

export async function sendPasswordResetEmail(email, resetToken) {
  try {
    const resetLink = `${process.env.APP_URL}/reset-password?token=${resetToken}`
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Password Reset Request',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Password Reset</h2>
          <p>Click the link below to reset your password:</p>
          <a href="${resetLink}" style="display: inline-block; background-color: #0B1C2D; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; margin-top: 20px;">Reset Password</a>
          <p style="color: #666; font-size: 12px; margin-top: 20px;">This link will expire in 1 hour.</p>
        </div>
      `,
    })
    return true
  } catch (error) {
    console.error('Email send error:', error)
    return false
  }
}

export async function sendLeadAssignmentEmail(email, leadName, agentName) {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: `New Lead Assigned: ${leadName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Lead Assignment</h2>
          <p>A new lead has been assigned to you:</p>
          <div style="background: #f5f5f5; padding: 15px; border-radius: 4px; margin: 20px 0;">
            <p><strong>Lead Name:</strong> ${leadName}</p>
            <p><strong>Assigned By:</strong> ${agentName}</p>
          </div>
          <a href="${process.env.APP_URL}/dashboard/leads" style="display: inline-block; background-color: #0B1C2D; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">View Lead</a>
        </div>
      `,
    })
    return true
  } catch (error) {
    console.error('Email send error:', error)
    return false
  }
}

export async function sendInvoiceEmail(email, invoiceData) {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: `Invoice #${invoiceData.invoiceNumber}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Invoice</h2>
          <div style="background: #f5f5f5; padding: 15px; border-radius: 4px;">
            <p><strong>Invoice #:</strong> ${invoiceData.invoiceNumber}</p>
            <p><strong>Amount:</strong> ${invoiceData.currency} ${invoiceData.amount}</p>
            <p><strong>Due Date:</strong> ${invoiceData.dueDate}</p>
          </div>
          <a href="${invoiceData.invoiceUrl}" style="display: inline-block; background-color: #0B1C2D; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; margin-top: 20px;">View Invoice</a>
        </div>
      `,
    })
    return true
  } catch (error) {
    console.error('Email send error:', error)
    return false
  }
}
