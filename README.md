**Vidya Sethu** is an admin dashboard for managing student scholarship applications — from submission through verification, approval, or rejection. Built with Node.js, Express, EJS, and MySQL, it lets administrators track pending/approved/rejected applications, review applicant details (CGPA, category, income) against scholarship eligibility, and manage scholarship listings with real-time seat and budget tracking, all through a searchable, filterable interface with CSV export.
How It Works:
1.Application intake — A student applies to a scholarship; the system stores their application linked to their student profile (CGPA, category, income) and the scholarship's eligibility criteria (minimum CGPA, income ceiling, category).
2.Verification — An admin reviews the applicant's documents/eligibility and marks the application as Verified, Pending, or Rejected at the verification stage.
3.Decision — Once verified, the admin approves or rejects the application from the dashboard with a single click; the applicant's status updates instantly across all views.
4.Tracking — Each application moves through a visual status tracker (Submitted → Verification → Decision), so both the admin and the record show exactly where it stands at any time.
5.Scholarship oversight — In parallel, admins monitor each scholarship's seat availability, budget utilization, and applicant volume, closing scholarships once seats are filled or deadlines pass.
6.Reporting — Admins can search, filter, and export any slice of the data (by status, scholarship, or college) as a CSV for offline review or reporting.
