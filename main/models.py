from django.db import models

class Student(models.Model):
    username = models.CharField(max_length=50)
    user_id = models.CharField(max_length=9)
    email = models.EmailField(max_length=200)
    password = models.CharField(max_length=50)
    student_staff_role = models.BooleanField(default=False)
    isNew = models.BooleanField(default=False)
    
    first_name = models.CharField(max_length=100, blank=True)
    last_name = models.CharField(max_length=100, blank=True)
    year_level = models.IntegerField(default=1)
    course = models.CharField(max_length=50, blank=True)
    section = models.CharField(max_length=50, blank=True)
    contact_num = models.CharField(max_length=20, blank=True)

    profile_picture_b64 = models.TextField(blank=True, null=True)

    def __str__(self):
        return self.username + " | " + self.user_id
    

class Staff(models.Model):
    fname = models.CharField(max_length=100)
    lname = models.CharField(max_length=50)
    user_id = models.CharField(max_length=9)
    email = models.EmailField(max_length=200)
    password = models.CharField(max_length=50)
    isNew = models.BooleanField(default=False)
    STAFF_CHOICES = [
        ('N', 'None'),
        ('C', 'Clinic'),
        ('B', 'Bao'),
    ]
    staff_role = models.CharField(max_length=1, choices=STAFF_CHOICES, default='N')
  #  account_created = models.DateTimeField(auto_now_add=True, null=True)
    
    def __str__(self):
        return self.fname + " " + self.lname + " | " + self.user_id
    

# ─────────────────────────────────────────────────────────
#  BAO CATALOG ITEM
#  Staff manages these via the staff dashboard.
# ─────────────────────────────────────────────────────────
class BaoItem(models.Model):

    CATEGORY_CHOICES = [
        ('uniform',  'Uniform'),
        ('id',       'ID / Lace'),
        ('supplies', 'Supplies'),
    ]

    STATUS_CHOICES = [
        ('in_stock',  'In Stock'),
        ('low_stock', 'Low Stock'),
        ('oos',       'Out of Stock'),
    ]

    name         = models.CharField(max_length=100)
    category     = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    description  = models.TextField(blank=True)
    emoji        = models.CharField(max_length=10, default='📦')  # display icon
    stock_status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='in_stock')
    restock_date = models.DateField(null=True, blank=True)        # shown when OOS

    # Comma-separated sizes e.g. "S,M,L,XL,XXL"
    # Empty string means no size selection needed (e.g. ID lace, exam booklet)
    sizes        = models.CharField(max_length=100, blank=True, default='')

    is_active    = models.BooleanField(default=True)  # hide from catalog without deleting
    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)

    # Base64-encoded image string (e.g. "data:image/jpeg;base64,/9j/...")
    # Null = no image uploaded
    image_base64 = models.TextField(blank=True, null=True)

    class Meta:
        ordering = ['category', 'name']

    def __str__(self):
        return f"{self.name} [{self.get_stock_status_display()}]"

    def sizes_list(self):
        """Return sizes as a Python list, or empty list if no sizes."""
        if self.sizes.strip():
            return [s.strip() for s in self.sizes.split(',')]
        return []


# ─────────────────────────────────────────────────────────
#  BAO ORDER (one per checkout)
# ─────────────────────────────────────────────────────────

class BaoOrder(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('ready',   'Ready for Claiming'),
        ('claimed', 'Claimed'),
        ('cancelled', 'Cancelled'),
    ]

    # Link to the student who placed it.
    # Using CharField to store student's user_id (matches Student.user_id)
    # so we don't need a foreign key to Student — keeps things simple.
    student_user_id = models.CharField(max_length=9)
    student_section = models.CharField(max_length=50, blank=True)
    student_name    = models.CharField(max_length=100, blank=True)

    order_number = models.CharField(max_length=12, unique=True)  # e.g. BAO-1042
    status       = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    note         = models.TextField(blank=True)

    placed_at    = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)

    # Staff who processed the claim (optional)
    processed_by = models.CharField(max_length=100, blank=True)

    class Meta:
        ordering = ['-placed_at']

    def __str__(self):
        return f"{self.order_number} — {self.student_user_id} [{self.get_status_display()}]"


# ─────────────────────────────────────────────────────────
#  BAO ORDER ITEM (one row per item in an order)
# ─────────────────────────────────────────────────────────

class BaoOrderItem(models.Model):
    order    = models.ForeignKey(BaoOrder, on_delete=models.CASCADE, related_name='items')
    item_name = models.CharField(max_length=100)  # snapshot at order time
    category  = models.CharField(max_length=20)
    size      = models.CharField(max_length=10, blank=True)  # blank if no size
    qty       = models.PositiveIntegerField(default=1)

    def __str__(self):
        size_str = f" — {self.size}" if self.size else ""
        return f"{self.item_name}{size_str} (×{self.qty})"
    




class ClinicAppointment(models.Model):

    SERVICE_CHOICES = [
        ('checkup', 'Physical Check-up'),
        ('records', 'Medical Record Processing'),
    ]

    STATUS_CHOICES = [
        ('confirmed',  'Confirmed'),
        ('completed',  'Completed'),
        ('cancelled',  'Cancelled'),
        ('no_show',    'No Show'),
    ]

    # All available time slots (matches the JS SLOTS list)
    TIME_SLOTS = [
        '8:00 AM', '8:30 AM', '9:00 AM', '9:30 AM',
        '10:00 AM', '10:30 AM',
        '1:00 PM', '1:30 PM', '2:00 PM', '2:30 PM',
        '3:00 PM', '3:30 PM',
    ]

    # Max bookings allowed per slot per day before it shows as FULL
    MAX_PER_SLOT = 3

    # Student info (snapshot, not a FK — keeps it simple)
    student_user_id = models.CharField(max_length=9)
    student_name    = models.CharField(max_length=100, blank=True)
    student_section = models.CharField(max_length=50, blank=True)

    appt_number = models.CharField(max_length=10, unique=True)  # e.g. C-0142

    service    = models.CharField(max_length=20, choices=SERVICE_CHOICES)
    appt_date  = models.DateField()           # e.g. 2025-05-08
    time_slot  = models.CharField(max_length=15)  # e.g. "9:00 AM"
    status     = models.CharField(max_length=20, choices=STATUS_CHOICES, default='confirmed')

    booked_at  = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Staff notes (filled during/after the appointment)
    staff_notes     = models.TextField(blank=True)
    attending_staff = models.CharField(max_length=100, blank=True)

    class Meta:
        ordering = ['appt_date', 'time_slot']

    def __str__(self):
        return f"{self.appt_number} — {self.student_user_id} | {self.appt_date} {self.time_slot} [{self.get_status_display()}]"

    def get_service_label(self):
        return dict(self.SERVICE_CHOICES).get(self.service, self.service)
    

    


class SCListing(models.Model):
    CATEGORY_CHOICES = [
        ('books',       'Books / Modules'),
        ('uniform',     'Uniform / Clothing'),
        ('electronics', 'Electronics'),
        ('merch',       'Merch / Accessories'),
        ('food',        'Food / Snacks'),
        ('services',    'Services'),
        ('other',       'Other'),
    ]

    CONDITION_CHOICES = [
        ('Brand New',  'Brand New'),
        ('Like New',   'Like New'),
        ('Good',       'Good'),
        ('Used',       'Used'),
        ('For Free',   'For Free'),
    ]

    STATUS_CHOICES = [
        ('available', 'Available'),
        ('reserved',  'Reserved'),
        ('sold',      'Sold'),
        ('removed',   'Removed'),   # soft-delete by moderator/staff
    ]

    # Poster info (snapshot — not FK, keeps it simple like BAO/Clinic)
    poster_user_id = models.CharField(max_length=9)
    poster_name    = models.CharField(max_length=100)

    reserved_by_user_id = models.CharField(max_length=9, blank=True)
    reserved_by_name = models.CharField(max_length=100, blank=True)

    title       = models.CharField(max_length=200)
    category    = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='other')
    condition   = models.CharField(max_length=20, choices=CONDITION_CHOICES, default='Good')
    price       = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    is_free     = models.BooleanField(default=False)
    description = models.TextField(blank=True)
    contact     = models.CharField(max_length=200, blank=True)

    # Base64-encoded image string (e.g. "data:image/jpeg;base64,/9j/...")
    # Null = no image uploaded
    image_base64 = models.TextField(blank=True, null=True)

    # Event drop listing — only moderators can set this
    is_event    = models.BooleanField(default=False)
    event_label = models.CharField(max_length=100, blank=True)  # e.g. "CICS Tech Fair 2025"

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='available')

    # Who removed it and why (for moderation log)
    removed_by   = models.CharField(max_length=100, blank=True)
    removed_note = models.CharField(max_length=300, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class Meta:
    ordering = ['-created_at']

def __str__(self):
    return f"{self.title} [{self.poster_name}] — {self.get_status_display()}"

def price_display(self):
    if self.is_free or self.condition == 'For Free':
        return 'FREE'
    return f'₱{self.price:,.2f}'


class SCModeratorApplication(models.Model):
    """A student's application to become a Student Center moderator."""

    STATUS_CHOICES = [
        ('pending',   'Pending Review'),
        ('approved',  'Approved'),
        ('rejected',  'Rejected'),
    ]

    # Applicant
    student_user_id = models.CharField(max_length=9)
    student_name    = models.CharField(max_length=100)
    student_email   = models.CharField(max_length=200, blank=True)

    reason = models.TextField()  # why they want to be a moderator

    status      = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    applied_at  = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)

    # Staff who reviewed it
    reviewed_by      = models.CharField(max_length=100, blank=True)
    rejection_reason = models.CharField(max_length=300, blank=True)

    class Meta:
        ordering = ['-applied_at']

    def __str__(self):
        return f"Application: {self.student_name} ({self.student_user_id}) — {self.get_status_display()}"




class SCModerator(models.Model):
    """An active Student Center moderator (approved student)."""

    student_user_id = models.CharField(max_length=9, unique=True)
    student_name    = models.CharField(max_length=100)
    student_email   = models.CharField(max_length=200, blank=True)

    granted_by  = models.CharField(max_length=100)  # staff name who approved
    granted_at  = models.DateTimeField(auto_now_add=True)
    is_active   = models.BooleanField(default=True)

    # Link to the application that led to this (optional reference)
    application_id = models.IntegerField(null=True, blank=True)

    class Meta:
        ordering = ['-granted_at']

    def __str__(self):
        status = "ACTIVE" if self.is_active else "REVOKED"
        return f"Moderator: {self.student_name} ({self.student_user_id}) — {status}"
    


class Notification(models.Model):

    TYPE_CHOICES = [
        ('bao_order',     'BAO Order Update'),
        ('bao_restock',   'BAO Item Restocked'),
        ('clinic',        'Clinic Appointment Reminder'),
        ('sc_reserved',   'Listing Reserved'),
        ('sc_contacted',  'Listing Contacted'),
    ]

    # Who receives this notification (student user_id)
    student_user_id = models.CharField(max_length=9, db_index=True)

    notif_type  = models.CharField(max_length=20, choices=TYPE_CHOICES)
    message     = models.CharField(max_length=300)

    # URL to navigate to when the notification is clicked
    # e.g. "/bao/" or "/student-center/" or "/clinic/"
    link        = models.CharField(max_length=200, blank=True, default='')

    is_read     = models.BooleanField(default=False, db_index=True)
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        read_str = "READ" if self.is_read else "UNREAD"
        return f"[{self.get_notif_type_display()}] → {self.student_user_id} — {read_str}"