import json
from datetime import timedelta
import random
import string
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages
from django.db.models import Q
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.views.decorators.csrf import csrf_exempt

from .models import Student, Staff, BaoItem, BaoOrder, BaoOrderItem, ClinicAppointment, SCListing, SCModeratorApplication, SCModerator, Notification

# ---------------------------------------------
#  HELPER - session guard clause
# ---------------------------------------------
def get_session_user(request):
    """Return (user_id, role, name) from session, or (None, None, None)."""
    return (
        request.session.get("user_id"),
        request.session.get("user_role"),
        request.session.get("user_name", "")
    )

def generate_order_number():
    while True:
        num = "BAO-" + "".join(random.choices(string.digits, k=4))
        if not BaoOrder.objects.filter(order_number=num).exists():
            return num


# ---------------------------------------------
#  GEN. PAGES
# ---------------------------------------------

def home(request):
    student_count = Student.objects.count()

    context = {
        'student_count': student_count
    }
    
    return render(request, 'base.html', context)

def game(request):
    return render(request, "game.html")

def about(request):
    return render(request, "about.html")

def choose_path(request):
    uid, role, name = get_session_user(request)

    student = None
    is_mod = False
    has_pending_app = False

    if uid and role == 'student':
        try:
            student = Student.objects.get(pk=uid)
            is_mod  = is_sc_moderator(student.user_id)
            if not is_mod:
                has_pending_app = SCModeratorApplication.objects.filter(
                    student_user_id=student.user_id,
                    status='pending'
                ).exists()
        except Student.DoesNotExist:
            pass
    context = {
        'student':         student,
        'is_moderator':    is_mod,
        'has_pending_app': has_pending_app,
        'user_role':       role,
    }
    return render(request, "choose_path.html", context)

# def clinic(request):
#     return render(request, "clinic.html")

from django.utils import timezone
from datetime import date

def dashboard(request):
    uid, role, name = get_session_user(request)

    if not uid or role != 'student':
        messages.error(request, "Please log in to view the dashboard.")
        return redirect("login")

    student = None
    is_mod = False
    has_pending_app = False
    
    # Initialize variables for the template
    bao_orders = []
    clinic_appts = []
    recent_activity = []
    next_clinic_appt = None
    stats = {
        'bao_total': 0, 'bao_active': 0, 'bao_completed': 0,
        'clinic_total': 0, 'clinic_upcoming': 0, 'clinic_completed': 0,
        'pending_items': 0, 'total_completed': 0
    }

    try:
        student = Student.objects.get(pk=uid)
        is_mod  = is_sc_moderator(student.user_id)
        if not is_mod:
            has_pending_app = SCModeratorApplication.objects.filter(
                student_user_id=student.user_id,
                status='pending'
            ).exists()
            
        bao_orders = BaoOrder.objects.filter(student_user_id=student.user_id).prefetch_related('items').order_by('-placed_at')
        clinic_appts = ClinicAppointment.objects.filter(student_user_id=student.user_id).order_by('-appt_date', '-time_slot')

        stats['bao_total'] = bao_orders.count()
        stats['bao_active'] = bao_orders.filter(status__in=['pending', 'ready']).count()
        stats['bao_completed'] = bao_orders.filter(status='claimed').count()

        stats['clinic_total'] = clinic_appts.count()
        stats['clinic_upcoming'] = clinic_appts.filter(status='confirmed', appt_date__gte=date.today()).count()
        stats['clinic_completed'] = clinic_appts.filter(status='completed').count()

        stats['pending_items'] = stats['bao_active']
        stats['total_completed'] = stats['bao_completed'] + stats['clinic_completed']

        next_clinic_appt = clinic_appts.filter(status='confirmed', appt_date__gte=date.today()).order_by('appt_date', 'time_slot').first()

        activities = []
        for o in bao_orders[:5]:
            items_str = ", ".join([f"{item.item_name} (×{item.qty})" for item in o.items.all()])
            activities.append({
                'type': 'bao',
                'title': f'BAO ORDER {o.order_number}',
                'status': o.status, 
                'sort_date': o.placed_at,
                'display_date': o.placed_at.strftime("%b %d"),
                'desc': items_str
            })
            
        for c in clinic_appts[:5]:
            activities.append({
                'type': 'clinic',
                'title': 'CLINIC APPT',
                'status': c.status,
                'sort_date': c.booked_at, 
                'display_date': c.appt_date.strftime("%b %d, %I:%M %p"),
                'desc': c.get_service_label()
            })
            
        recent_activity = sorted(activities, key=lambda x: x['sort_date'], reverse=True)[:4]

    except Student.DoesNotExist:
        pass

    context = {
        'student':         student,
        'is_moderator':    is_mod,
        'has_pending_app': has_pending_app,
        'user_role':       role,
        'student_id':      uid,
        'bao_orders':      bao_orders,
        'clinic_appts':    clinic_appts,
        'stats':           stats,
        'recent_activity': recent_activity,
        'next_clinic_appt': next_clinic_appt,
    }
    return render(request, "dashboard.html", context)

def student_center(request):
    return render(request, "student_center.html")

def staff_sc_clinic(request):
    return render(request, "staff_sc_clinic.html")

def staff_sc_bao(request):
    return render(request, "staff_sc_bao.html")



# ---------------------------------------------
#  CHOOSE_ROLE  (staff only - unchanged from previous ver. control)
# ---------------------------------------------
def choose_role(request):
    uid, role, name = get_session_user(request)
    request.session['role'] = 'staff'
    request.session.modified = True
    role = request.session['role']
    
    # for debug:
    print("----- DEBUG SESSION INFO -----")
    print(f"UID: {uid}")
    print(f"ROLE: '{role}'")
    

    staff, created = Staff.objects.get_or_create(pk=uid)

    if request.method == "POST":
        if request.POST.get("clinic-staff-role") == "C":
            chosen_role = 'C'
        elif request.POST.get("bao-staff-role") == "B":
            chosen_role = 'B'
        else:
            messages.error(request, "Please select a valid department role.")
            return render(request, "choose_staffrole.html", {'staff': staff})

        staff.staff_role = chosen_role
        staff.save()
        
        if chosen_role == 'C':
            return redirect("clinic_staff")
        else:
            return redirect("bao_staff")

    return render(request, "choose_staffrole.html", {'staff': staff})
    


# ---------------------------------------------
#  LOGIN  (unchanged from previous ver. control)
# ---------------------------------------------

def login(request):
    context = {}
    # --------------
    #  REGISTER
    # --------------
    if request.method == "POST" and request.POST.get("authentication") == "signingUp":
        user_email = request.POST.get("email", "").strip()
        user_id = request.POST.get("uid", "").strip()
        user_role = request.POST.get("role", "student").strip()
        passwords = request.POST.getlist("password")
        user_pw = passwords[0] if len(passwords) > 0 else ""
        user_pw2 = passwords[1] if len(passwords) > 1 else ""

        context = {
            'submitted_email': user_email,
            'submitted_uid': user_id,
            'submitted_role': user_role,
            'submitted_pw' : passwords[0],
            'submitted_confirm_pw' : passwords[1], 
            'show_signup': True 
        }

        if not user_email or not user_id or not user_pw or not user_pw2:
            messages.error(request, "Please fill in all fields.")
            return render(request, "login.html", context) 

        if user_pw != user_pw2:
            messages.error(request, "Passwords do not match.")
            return render(request, "login.html", context)

        if len(user_pw) < 8:
            messages.error(request, "Password must be at least 8 characters.")
            return render(request, "login.html", context)

        if user_role == "staff":
            if Staff.objects.filter(email=user_email).exists():
                messages.error(request, "A staff account with this email already exists.")
                return render(request, "login.html", context)
                
            if Staff.objects.filter(user_id=user_id).exists():
                messages.error(request, "This Staff ID is already registered.")
                return render(request, "login.html", context)
                
            Staff.objects.create(fname="Staff", lname="", user_id=user_id, email=user_email, password=user_pw)
            messages.success(request, "Staff account created! Please select your corresponding role inside LSPU.")
            return redirect("choose-role")

        if Student.objects.filter(email=user_email).exists():
            messages.error(request, "An account with this email already exists.")
            return render(request, "login.html", context)
            
        if Student.objects.filter(user_id=user_id).exists():
            messages.error(request, "This Student ID is already registered.")
            return render(request, "login.html", context)

        base_username = user_email.split("@")[0]
        username = base_username
        if Student.objects.filter(username=username).exists():
            username = f"{base_username}_{user_id.replace('-', '')}"

        Student.objects.create(username=username, user_id=user_id, email=user_email, password=user_pw)
        messages.success(request, "Account created! You can now log in.")
        return redirect("choose-role")

    # --------------
    #  LOGGING IN
    # --------------
    elif request.method == "POST" and request.POST.get("authentication") == "loggingIn":
        login_id = request.POST.get("uid", "").strip()
        user_pw = request.POST.get("password", "").strip()
        user_role = request.POST.get("role", "student").strip()

        if not login_id or not user_pw:
            messages.error(request, "Please fill in your ID/email and password.")
            return redirect("login")

        if user_role == "staff":
            staff = Staff.objects.filter(
                Q(email=login_id) | Q(user_id=login_id), password=user_pw).first()
            if staff :
                request.session["user_id"] = staff.id
                request.session["user_role"] = "staff"
                request.session["user_name"] = f"{staff.fname} {staff.lname}".strip()
                messages.success(request, f"Welcome back, {staff.fname}!")
                if staff.staff_role == 'C':
                    return redirect("clinic_staff")
                elif staff.staff_role == 'B':
                    return redirect("bao_staff")
            else:
                messages.error(request, "Invalid Staff ID/email or password.")
                return redirect("login")

        student = Student.objects.filter(
            Q(email=login_id) | Q(user_id=login_id), password=user_pw).first()
        if student:
            request.session["user_id"] = student.id
            request.session["user_role"] = "student"
            request.session["user_name"] = student.username
            messages.success(request, f"Welcome, {student.username}!")
            return redirect("choose_path")
        else:
            messages.error(request, "Invalid Student ID/email or password.")
            return redirect("login")

    return render(request, "login.html")


# ---------------------------------------------
#  BAO - student view
# ---------------------------------------------

def bao(request):
    """
    Renders the BAO catalog page.
    Passes all active BaoItems to the template so the HTML
    is generated from the DB instead of being hardcoded.
    Also passes session info so the order summary auto-fills.
    """
    uid, role, name = get_session_user(request)

    # Get student record to populate the order summary
    student = None
    if uid and role == "student":
        try:
            student = Student.objects.get(pk=uid)
        except Student.DoesNotExist:
            pass

    items = BaoItem.objects.filter(is_active=True)

    context = {
        "items": items,
        "student": student,
    }
    return render(request, "bao.html", context)


# ---------------------------------------------
#  BAO - place order  (AJAX POST from JS)
# ---------------------------------------------
@require_POST
def bao_place_order(request):
    # Called by fetch() in bao.js when the student user clicks
    # Expects JSON body:
    # {
    #   "items": [
    #     {"name": "PE Uniform — L", "category": "uniform", "size": "L"},
    #     ...
    #   ],
    #   "note": "optional staff note"
    # }
    # Returns JSON:
    # {
    #   "ok": true,
    #   "order_number": "BAO-1042",
    #   "placed_at": "May 5, 2025 · 09:32 AM"
    # }
    
    uid, role, name = get_session_user(request)

    # must be logged
    if not uid or role != "student":
        return JsonResponse({"ok": False, "error": "Please log in to place an order."}, status=403)

    try:
        student = Student.objects.get(pk=uid)
    except Student.DoesNotExist:
        return JsonResponse({"ok": False, "error": "Student account not found."}, status=403)

    try:
        payload = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"ok": False, "error": "Invalid request data."}, status=400)

    order_items = payload.get("items", [])
    note        = payload.get("note", "").strip()

    if not order_items:
        return JsonResponse({"ok": False, "error": "Your cart is empty."}, status=400)

    # create order block
    order_number = generate_order_number()
    order = BaoOrder.objects.create(
        student_user_id = student.user_id,
        student_name = student.username,
        student_section = "",  # populate from profile when profile module is done
        order_number = order_number,
        note = note,
        status = "pending",
    )

    for line in order_items:
        BaoOrderItem.objects.create(
            order = order,
            item_name = line.get("name", "Unknown"),
            category = line.get("category", ""),
            size = line.get("size", ""),
            qty = 1,
        )

    placed_str = order.placed_at.strftime("%B %d, %Y · %I:%M %p") # confirmation slip

    return JsonResponse({
        "ok": True,
        "order_number": order.order_number,
        "placed_at": placed_str,
        "student_id": student.user_id,
        "student_name": student.username,
    })


# ---------------------------------------------
#  BAO - staff view
# ---------------------------------------------

def bao_staff(request):
    """
    Staff-only view. Shows:
      - All pending / ready orders (most recent first)
      - Full inventory management (add / edit / toggle stock)
    """
    uid, role, name = get_session_user(request)
    if not uid or role != "staff":
        messages.error(request, "Staff access required.")
        return redirect("login")
    if not uid or role != "staff":
        messages.error(request, "Staff access required.")
        return redirect("login")
    
    orders = BaoOrder.objects.prefetch_related("items").all()
    items  = BaoItem.objects.all()

    context = {
        "orders": orders,
        "items": items,
        "staff_name": name,
    }
    return render(request, "staff_bao.html", context)


# ---------------------------------------------
#  BAO - update order status  (staff )
# ---------------------------------------------

@require_POST
def bao_update_order_status(request):
    """
    Staff marks an order as ready / claimed / cancelled.

    POST body (form-encoded or JSON):
      order_id   — BaoOrder pk
      status     — 'pending' | 'ready' | 'claimed' | 'cancelled'
      processed_by — staff name (optional)
    """
    uid, role, _ = get_session_user(request)
    if not uid or role != "staff":
        return JsonResponse({"ok": False, "error": "Staff access required."}, status=403)

    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        data = request.POST

    order_id = data.get("order_id")
    new_status = data.get("status", "")
    processed_by = data.get("processed_by", "").strip()

    valid_statuses = [s[0] for s in BaoOrder.STATUS_CHOICES]
    if new_status not in valid_statuses:
        return JsonResponse({"ok": False, "error": "Invalid status."}, status=400)

    order = get_object_or_404(BaoOrder, pk=order_id)
    order.status = new_status
    if processed_by:
        order.processed_by = processed_by
    order.save()

    # --- NEW: Notify the student that their order status changed ---
    if new_status in ['ready', 'claimed']:
        Notification.objects.create(
            student_user_id=order.student_user_id,
            notif_type='bao_order',
            message=f"Your BAO order {order.order_number} is now {order.get_status_display().upper()}.",
            link='/dashboard/#records'
        )

    return JsonResponse({"ok": True, "order_number": order.order_number, "status": order.status})


# ---------------------------------------------
#  BAO - update item stock  (staff)
# ---------------------------------------------

@require_POST
def bao_update_stock(request):
    """
    Staff updates an item's stock status and optional restock date.

    JSON body:
    {
      "item_id":      1,
      "stock_status": "in_stock" | "low_stock" | "oos",
      "restock_date": "2025-05-05"   (optional, used when OOS)
    }
    """
    uid, role, _ = get_session_user(request)
    if not uid or role != "staff":
        return JsonResponse({"ok": False, "error": "Staff access required."}, status=403)

    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"ok": False, "error": "Invalid JSON."}, status=400)

    item_id      = data.get("item_id")
    stock_status = data.get("stock_status", "")
    restock_date = data.get("restock_date", None)

    valid_statuses = [s[0] for s in BaoItem.STATUS_CHOICES]
    if stock_status not in valid_statuses:
        return JsonResponse({"ok": False, "error": "Invalid stock status."}, status=400)

    item = get_object_or_404(BaoItem, pk=item_id)
    item.stock_status = stock_status
    if restock_date:
        from datetime import date
        try:
            item.restock_date = date.fromisoformat(restock_date)
        except ValueError:
            pass
    else:
        item.restock_date = None
    item.save()

    # --- NEW: Mass notify all students if an item is back in stock ---
    if stock_status == 'in_stock':
        students = Student.objects.all()
        # We use bulk_create to make it incredibly fast, generating thousands of rows instantly
        notifs = [
            Notification(
                student_user_id=s.user_id,
                notif_type='bao_restock',
                message=f"Restock Alert: {item.name} is now available in the BAO catalog!",
                link='/bao/'
            ) for s in students
        ]
        Notification.objects.bulk_create(notifs)

    return JsonResponse({"ok": True, "item_id": item.id, "stock_status": item.stock_status})


# ---------------------------------------------
#  BAO — add/edit item  (staff)
# ---------------------------------------------

@require_POST
def bao_save_item(request):
    """JSON body:
    {
      "item_id":      null,           (null = create new)
      "name":         "PE Uniform",
      "category":     "uniform",
      "description":  "...",
      "emoji":        "👕",
      "stock_status": "in_stock",
      "sizes":        "S,M,L,XL,XXL",
      "restock_date": null
    }"""
    
    uid, role, _ = get_session_user(request)
    if not uid or role != "staff":
        return JsonResponse({"ok": False, "error": "Staff access required."}, status=403)

    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"ok": False, "error": "Invalid JSON."}, status=400)

    item_id = data.get("item_id")
    
    # 1. TRACK IF THIS IS A BRAND NEW ITEM BEFORE WE SAVE IT
    is_new_item = not bool(item_id) 

    if item_id:
        item = get_object_or_404(BaoItem, pk=item_id)
    else:
        item = BaoItem()

    item.name = data.get("name", "").strip()
    item.category = data.get("category", "supplies")
    item.description = data.get("description", "").strip()
    item.image_base64 = data.get('image_base64', None)
    item.stock_status = data.get("stock_status", "in_stock")
    item.sizes = data.get("sizes", "").strip()
    item.is_active = data.get("is_active", True)

    restock_date = data.get("restock_date")
    if restock_date:
        from datetime import date
        try:
            item.restock_date = date.fromisoformat(restock_date)
        except ValueError:
            item.restock_date = None
    else:
        item.restock_date = None

    if not item.name:
        return JsonResponse({"ok": False, "error": "Item name is required."}, status=400)

    item.save()

    # 2. MASS NOTIFY ALL STUDENTS IF IT IS A NEW, ACTIVE, IN-STOCK ITEM
    if is_new_item and item.is_active and item.stock_status == 'in_stock':
        students = Student.objects.all()
        notifs = [
            Notification(
                student_user_id=s.user_id,
                notif_type='bao_restock',
                message=f" SYSTEM: New item ({item.name}) has just been added to the BAO catalog!",
                link='/bao/'
            ) for s in students
        ]
        Notification.objects.bulk_create(notifs)

    return JsonResponse({"ok": True, "item_id": item.id, "name": item.name})


# ---------------------------------------------
#  BAO — delete item  (staff)
# ---------------------------------------------

@require_POST
def bao_delete_item(request):
    """Hard-delete a catalog item from the MySQL database."""
    uid, role, _ = get_session_user(request)
    if not uid or role != "staff":
        return JsonResponse({"ok": False, "error": "Staff access required."}, status=403)

    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"ok": False, "error": "Invalid JSON."}, status=400)

    item = get_object_or_404(BaoItem, pk=data.get("item_id"))
    
    # Actually delete the row from the MySQL database
    item.delete() 
    
    return JsonResponse({"ok": True})


# ---------------------------------------------
#  CLINIC - HELPES
# ---------------------------------------------
def generate_appt_number():
    while True:
        num = "C-" + "".join(random.choices(string.digits, k=4))
        if not ClinicAppointment.objects.filter(appt_number=num).exists():
            return num


def get_slot_availability(appt_date):
    from django.db.models import Count
    counts = (
        ClinicAppointment.objects
        .filter(appt_date=appt_date, status='confirmed')
        .values('time_slot')
        .annotate(count=Count('id'))
    )
    return {row['time_slot']: row['count'] for row in counts}


# ---------------------------------------------
#  CLINIC - student view
# ---------------------------------------------

def clinic(request):
    uid, role, name = get_session_user(request)
    student = None
    if uid and role == "student":
        try:
            student = Student.objects.get(pk=uid)
        except Student.DoesNotExist:
            pass
    return render(request, "clinic.html", {"student": student})


# ---------------------------------------------
#  CLINIC - slot availability  (AJAX GET)
# ---------------------------------------------

def clinic_slots(request):
    from datetime import date as date_cls

    month_str = request.GET.get("month") # monthly summ. heat map
    if month_str:
        try:
            year, month = [int(x) for x in month_str.split("-")]
        except (ValueError, TypeError):
            return JsonResponse({"error": "Invalid month format. Use YYYY-MM."}, status=400)

        from django.db.models import Count
        daily_counts = (
            ClinicAppointment.objects
            .filter(appt_date__year=year, appt_date__month=month, status="confirmed")
            .values("appt_date", "service")
            .annotate(count=Count("id"))
        )
        summary = {}
        for row in daily_counts:
            d = row["appt_date"].day
            if d not in summary:
                summary[d] = {"total": 0, "checkup": 0, "records": 0}
            summary[d]["total"] += row["count"]
            summary[d][row["service"]] += row["count"]
        return JsonResponse({"month": month_str, "days": summary})

    date_str = request.GET.get("date")
    if not date_str:
        return JsonResponse({"error": "Provide ?date=YYYY-MM-DD or ?month=YYYY-MM"}, status=400)

    try:
        appt_date = date_cls.fromisoformat(date_str)
    except ValueError:
        return JsonResponse({"error": "Invalid date format."}, status=400)

    booked = get_slot_availability(appt_date)
    max_per_slot = ClinicAppointment.MAX_PER_SLOT

    slot_data = []
    for slot in ClinicAppointment.TIME_SLOTS:
        count = booked.get(slot, 0)
        slot_data.append({"time": slot, "count": count, "max": max_per_slot, "full": count >= max_per_slot})

    return JsonResponse({"date": date_str, "slots": slot_data, "total_booked": sum(booked.values())})


# ---------------------------------------------
#  CLINIC — book appointment  (AJAX POST)
# ---------------------------------------------

@require_POST
def clinic_book(request):
    from datetime import date as date_cls

    uid, role, name = get_session_user(request)
    if not uid or role != "student":
        return JsonResponse({"ok": False, "error": "Please log in to book an appointment."}, status=403)

    try:
        student = Student.objects.get(pk=uid)
    except Student.DoesNotExist:
        return JsonResponse({"ok": False, "error": "Student account not found."}, status=403)

    try:
        payload = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"ok": False, "error": "Invalid request data."}, status=400)

    service   = payload.get("service", "").strip()
    date_str  = payload.get("date", "").strip()
    time_slot = payload.get("time_slot", "").strip()

    valid_services = [s[0] for s in ClinicAppointment.SERVICE_CHOICES]
    if service not in valid_services:
        return JsonResponse({"ok": False, "error": "Invalid service."}, status=400)

    if time_slot not in ClinicAppointment.TIME_SLOTS:
        return JsonResponse({"ok": False, "error": "Invalid time slot."}, status=400)

    try:
        appt_date = date_cls.fromisoformat(date_str)
    except ValueError:
        return JsonResponse({"ok": False, "error": "Invalid date."}, status=400)

    if appt_date <= date_cls.today():
        return JsonResponse({"ok": False, "error": "Please select a future date."}, status=400)

    
    booked = get_slot_availability(appt_date) 
    if booked.get(time_slot, 0) >= ClinicAppointment.MAX_PER_SLOT:
        return JsonResponse({"ok": False, "error": "This time slot is already full. Please pick another."}, status=409)

    # to check for duplicate booking same student same day
    if ClinicAppointment.objects.filter(student_user_id=student.user_id, appt_date=appt_date, status="confirmed").exists():
        return JsonResponse({"ok": False, "error": "You already have a confirmed appointment on this date."}, status=409)

    appt_number = generate_appt_number()
    appt = ClinicAppointment.objects.create(
        student_user_id=student.user_id,
        student_name=student.username,
        student_section="",
        appt_number=appt_number,
        service=service,
        appt_date=appt_date,
        time_slot=time_slot,
        status="confirmed",
    )

    return JsonResponse({
        "ok":           True,
        "appt_number":  appt.appt_number,
        "booked_at":    appt.booked_at.strftime("%B %d, %Y · %I:%M %p"),
        "service":      appt.get_service_label(),
        "date":         appt.appt_date.strftime("%B %d, %Y"),
        "time_slot":    appt.time_slot,
        "student_id":   student.user_id,
        "student_name": student.username,
    })


# ---------------------------------------------
#  CLINIC - staff view
# ---------------------------------------------

def clinic_staff(request):
    uid, role, name = get_session_user(request)
    if not uid or role != "staff":
        messages.error(request, "Staff access required.")
        return redirect("login")

    from datetime import date as date_cls
    today_date = date_cls.today()

    today_appts  = ClinicAppointment.objects.filter(appt_date=today_date, status="confirmed")
    today_checkup = today_appts.filter(service="checkup").count()
    today_records = today_appts.filter(service="records").count()
    today_total   = today_appts.count()
    week_total    = ClinicAppointment.objects.filter(
        appt_date__range=(today_date, today_date + timedelta(days=6)),
        status="confirmed"
    ).count()

    upcoming = ClinicAppointment.objects.filter(
        appt_date__gte=today_date, status="confirmed"
    ).order_by("appt_date", "time_slot")

    return render(request, "staff_clinic.html", {
        "staff_name":    name,
        "today_total":   today_total,
        "today_checkup": today_checkup,
        "today_records": today_records,
        "week_total":    week_total,
        "upcoming":      upcoming,
    })


# ---------------------------------------------
#  CLINIC - update status  (staff)
# ---------------------------------------------

@require_POST
def clinic_update_status(request):
    uid, role, _ = get_session_user(request)
    if not uid or role != "staff":
        return JsonResponse({"ok": False, "error": "Staff access required."}, status=403)

    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"ok": False, "error": "Invalid JSON."}, status=400)

    valid_statuses = [s[0] for s in ClinicAppointment.STATUS_CHOICES]
    new_status = data.get("status", "")
    if new_status not in valid_statuses:
        return JsonResponse({"ok": False, "error": "Invalid status."}, status=400)

    appt = get_object_or_404(ClinicAppointment, pk=data.get("appt_id"))
    appt.status = new_status
    if data.get("staff_notes"):   appt.staff_notes = data["staff_notes"].strip()
    if data.get("attending_staff"): appt.attending_staff = data["attending_staff"].strip()
    appt.save()

    return JsonResponse({"ok": True, "appt_number": appt.appt_number, "status": appt.status})


# ---------------------------------------------
#  CLINIC - cancel  (student self-cancel)
# ---------------------------------------------

@require_POST
def clinic_cancel(request):
    uid, role, _ = get_session_user(request)
    if not uid or role != "student":
        return JsonResponse({"ok": False, "error": "Not authorized."}, status=403)

    try:
        data    = json.loads(request.body)
        student = Student.objects.get(pk=uid)
    except (json.JSONDecodeError, ValueError, Student.DoesNotExist):
        return JsonResponse({"ok": False, "error": "Invalid request."}, status=400)

    appt = get_object_or_404(ClinicAppointment, appt_number=data.get("appt_number"), student_user_id=student.user_id)
    if appt.status != "confirmed":
        return JsonResponse({"ok": False, "error": "Appointment cannot be cancelled."}, status=400)

    appt.status = "cancelled"
    appt.save()
    return JsonResponse({"ok": True, "appt_number": appt.appt_number})


# ---------------------------------------------
#  STUDENT CENTER - HELPERS
# ---------------------------------------------

def is_sc_moderator(student_user_id):
    """Return True if the given student is an active SC moderator."""
    return SCModerator.objects.filter(
        student_user_id=student_user_id, is_active=True
    ).exists()


def time_ago_str(dt):
    """Return a human-readable time-ago string for a datetime."""
    from django.utils import timezone
    now   = timezone.now()
    diff  = now - dt
    secs  = int(diff.total_seconds())
    if secs < 60:        return 'just now'
    if secs < 3600:      return f'{secs // 60} min ago'
    if secs < 86400:     return f'{secs // 3600} hr ago'
    if secs < 604800:    return f'{secs // 86400} days ago'
    return dt.strftime('%b %d')


def listing_to_dict(listing):
    """Serialize a SCListing to a JSON-safe dict for the frontend."""
    
    # NEW: Fetch the poster's profile picture dynamically so it is always up-to-date
    poster_pfp = None
    try:
        student = Student.objects.get(user_id=listing.poster_user_id)
        poster_pfp = student.profile_picture_b64
    except Student.DoesNotExist:
        pass

    return {
        'id':           listing.id,
        'title':        listing.title,
        'category':     listing.category,
        'condition':    listing.condition,
        'price':        str(listing.price),
        'is_free':      listing.is_free,
        'description':  listing.description,
        'contact':      listing.contact,
        'image_base64': listing.image_base64 or None,
        'is_event':     listing.is_event,
        'event_label':  listing.event_label,
        'status':       listing.status,
        'poster_user_id': listing.poster_user_id,
        'poster_name':  listing.poster_name,
        'poster_pfp':   poster_pfp, # <--- NEW FIELD PASSED TO JS
        'time_ago':     time_ago_str(listing.created_at),
    }


# ---------------------------------------------
#  STUDENT CENTER — MAIN PAGE
# ---------------------------------------------

def student_center(request):
    # """
    # Renders the Student Center page.
    # Passes session user info + moderator status so the
    # template can show/hide the event posting option and
    # the moderator apply button.
    # """
    uid, role, name = get_session_user(request)

    student   = None
    is_mod    = False
    has_pending_app = False

    if uid and role == 'student':
        try:
            student = Student.objects.get(pk=uid)
            is_mod  = is_sc_moderator(student.user_id)
            if not is_mod:
                has_pending_app = SCModeratorApplication.objects.filter(
                    student_user_id=student.user_id,
                    status='pending'
                ).exists()
        except Student.DoesNotExist:
            pass

    context = {
        'student':         student,
        'is_moderator':    is_mod,
        'has_pending_app': has_pending_app,
        'user_role':       role,
    }
    return render(request, 'student_center.html', context)


# ---------------------------------------------
#  STUDENT CENTER — browse listings  (AJAX GET)
# ---------------------------------------------

def sc_listings(request):
    # """
    # GET /student-center/listings/?cat=all&q=&sort=newest
    # Returns JSON list of active listings for the browse grid.
    # """
    cat = request.GET.get('cat',  'all').strip()
    q = request.GET.get('q',    '').strip()
    sort = request.GET.get('sort', 'newest').strip()

    qs = SCListing.objects.exclude(status='removed')

    if cat != 'all':
        qs = qs.filter(category=cat)

    if q:
        qs = qs.filter(
            Q(title__icontains=q) |
            Q(description__icontains=q) |
            Q(poster_name__icontains=q)
        )

    if sort == 'price_asc':
        qs = qs.order_by('is_free', 'price', '-created_at')
    elif sort == 'ending':
        qs = qs.filter(is_event=True).order_by('-created_at')
    else:  # newest
        qs = qs.order_by('-created_at')

    return JsonResponse({'listings': [listing_to_dict(l) for l in qs]})


# ═══════════════════════════════════════════════════════
#  STUDENT CENTER — MY LISTINGS  (AJAX GET)
# ═══════════════════════════════════════════════════════

def sc_my_listings(request):
    """GET /student-center/my-listings/ — returns the logged-in student's listings."""
    uid, role, _ = get_session_user(request)
    if not uid or role != 'student':
        return JsonResponse({'ok': False, 'error': 'Please log in.'}, status=403)

    try:
        student = Student.objects.get(pk=uid)
    except Student.DoesNotExist:
        return JsonResponse({'ok': False, 'error': 'Student not found.'}, status=403)

    listings = SCListing.objects.filter(
        poster_user_id=student.user_id
    ).exclude(status='removed').order_by('-created_at')

    return JsonResponse({'listings': [listing_to_dict(l) for l in listings]})


# ═══════════════════════════════════════════════════════
#  STUDENT CENTER — POST LISTING  (AJAX POST)
# ═══════════════════════════════════════════════════════

@require_POST
def sc_post_listing(request):
    """
    POST /student-center/post-listing/
    JSON body: { title, category, condition, price, is_free,
                 description, contact, is_event, event_label,
                 image_base64 }

    Rules:
    - Any student can post a regular listing (immediately live)
    - Only moderators can post event listings (is_event=True)
    - If a regular student tries is_event=True, it's ignored
    """
    uid, role, _ = get_session_user(request)
    if not uid or role != 'student':
        return JsonResponse({'ok': False, 'error': 'Please log in to post a listing.'}, status=403)

    try:
        student = Student.objects.get(pk=uid)
    except Student.DoesNotExist:
        return JsonResponse({'ok': False, 'error': 'Student not found.'}, status=403)

    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({'ok': False, 'error': 'Invalid request data.'}, status=400)

    title    = data.get('title', '').strip()
    category = data.get('category', 'other').strip()
    condition = data.get('condition', 'Good').strip()
    desc     = data.get('description', '').strip()
    contact  = data.get('contact', '').strip()
    is_free  = bool(data.get('is_free', False))
    is_event = bool(data.get('is_event', False))
    ev_label = data.get('event_label', '').strip()
    img_b64  = data.get('image_base64', None)

    try:
        price = float(data.get('price', 0))
    except (ValueError, TypeError):
        price = 0.0

    if not title:
        return JsonResponse({'ok': False, 'error': 'Title is required.'}, status=400)
    if not desc:
        return JsonResponse({'ok': False, 'error': 'Description is required.'}, status=400)
    if not is_free and condition != 'For Free' and price <= 0:
        return JsonResponse({'ok': False, 'error': 'Please enter a valid price or mark as free.'}, status=400)

    # validate categ. and conditions firs (if they meet the set standards)
    valid_cats  = [c[0] for c in SCListing.CATEGORY_CHOICES]
    valid_conds = [c[0] for c in SCListing.CONDITION_CHOICES]
    if category not in valid_cats:   category  = 'other'
    if condition not in valid_conds: condition = 'Good'

    # only moderators can post event listings
    mod_status = is_sc_moderator(student.user_id)
    if is_event and not mod_status:
        # silently downgrade to regular listing (couldnt fix the prev. lol)
        is_event = False
        ev_label = ''

    listing = SCListing.objects.create(
        poster_user_id = student.user_id,
        poster_name    = student.username,
        title          = title,
        category       = category,
        condition      = condition,
        price          = price,
        is_free        = is_free or condition == 'For Free',
        description    = desc,
        contact        = contact,
        is_event       = is_event,
        event_label    = ev_label if is_event else '',
        image_base64   = img_b64,
        status         = 'available',
    )

    return JsonResponse({
        'ok':              True,
        'listing_id':      listing.id,
        'pending_approval': False,  # All listings go live immediately
    })


# ---------------------------------------------
#  STUDENT CENTER - reserve listing  (AJAX POST)
# ---------------------------------------------

@require_POST
def sc_reserve(request):
    """POST /student-center/reserve/ — mark a listing as reserved."""
    uid, role, _ = get_session_user(request)
    if not uid or role != 'student':
        return JsonResponse({'ok': False, 'error': 'Please log in.'}, status=403)

    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({'ok': False, 'error': 'Invalid data.'}, status=400)

    listing = get_object_or_404(SCListing, pk=data.get('listing_id'))

    if listing.status != 'available':
        return JsonResponse({'ok': False, 'error': 'This item is no longer available.'}, status=409)

    try:
        student = Student.objects.get(pk=uid)
    except Student.DoesNotExist:
        return JsonResponse({'ok': False, 'error': 'Student not found.'}, status=403)

    # to prevent reserving own listing
    if listing.poster_user_id == student.user_id:
        return JsonResponse({'ok': False, 'error': "You can't reserve your own listing."}, status=400)

    listing.status = 'reserved'
    listing.reserved_by_user_id = student.user_id # Saves who reserved it
    listing.reserved_by_name = student.username
    listing.save()

    # --- NEW: Notify the SELLER ---
    Notification.objects.create(
        student_user_id=listing.poster_user_id,
        notif_type='sc_reserved',
        message=f"🔖 {student.username} wants to reserve your listing: {listing.title}. Please confirm with them.",
        link=f'/student-center/?action=review_reserve&listing_id={listing.id}&buyer_id={student.user_id}' # <--- SMART LINK
    )

    # --- NEW: Notify the BUYER ---
    Notification.objects.create(
        student_user_id=student.user_id,
        notif_type='sc_reserved',
        message=f"⏳ Reserve request sent for {listing.title}. Waiting for seller response.",
        link='/student-center/'
    )

    return JsonResponse({'ok': True})


# ---------------------------------------------
#  STUDENT CENTER - mark as sold  (AJAX POST)
# ---------------------------------------------

@require_POST
def sc_mark_sold(request):
    """POST /student-center/mark-sold/ — poster marks their own listing as sold."""
    uid, role, _ = get_session_user(request)
    if not uid or role != 'student':
        return JsonResponse({'ok': False, 'error': 'Not authorized.'}, status=403)

    try:
        data    = json.loads(request.body)
        student = Student.objects.get(pk=uid)
    except (json.JSONDecodeError, ValueError, Student.DoesNotExist):
        return JsonResponse({'ok': False, 'error': 'Invalid request.'}, status=400)

    listing = get_object_or_404(SCListing, pk=data.get('listing_id'))

    # Ownership check
    if listing.poster_user_id != student.user_id:
        return JsonResponse({'ok': False, 'error': 'You can only mark your own listings.'}, status=403)

    listing.status = 'sold'
    listing.save()
    return JsonResponse({'ok': True})


# ---------------------------------------------
#  STUDENT CENTER - delete listing  (AJAX POST)
# ---------------------------------------------

@require_POST
def sc_delete_listing(request):
    # """
    # POST /student-center/delete-listing/
    # Students can delete their own listings.
    # Moderators and staff can delete any listing (moderation).
    # """
    uid, role, name = get_session_user(request)
    if not uid:
        return JsonResponse({'ok': False, 'error': 'Not authorized.'}, status=403)

    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({'ok': False, 'error': 'Invalid data.'}, status=400)

    listing = get_object_or_404(SCListing, pk=data.get('listing_id'))
    note    = data.get('reason', '').strip()

    # staff can always remove (but students with no atuhority cant)
    if role == 'staff':
        listing.status = 'removed'
        listing.removed_by = name
        listing.removed_note = note
        listing.save()
        return JsonResponse({'ok': True})

    try:
        student = Student.objects.get(pk=uid)
    except Student.DoesNotExist:
        return JsonResponse({'ok': False, 'error': 'Student not found.'}, status=403)

    if listing.poster_user_id == student.user_id:
        # hard remove
        listing.status = 'removed'
        listing.removed_by = student.username
        listing.removed_note = 'Deleted by owner'
        listing.save()
        return JsonResponse({'ok': True})

    if is_sc_moderator(student.user_id):
        # Moderator removing a violating listing
        listing.status = 'removed'
        listing.removed_by = f'{student.username} (moderator)'
        listing.removed_note = note or 'Removed by moderator'
        listing.save()
        return JsonResponse({'ok': True})

    return JsonResponse({'ok': False, 'error': 'Not authorized to delete this listing.'}, status=403)


# ---------------------------------------------
#  STUDENT CENTER - apply for moderator  (AJAX POST)
# ---------------------------------------------

@require_POST
def sc_apply_moderator(request):
    # """
    # POST /student-center/apply-moderator/
    # JSON: { "reason": "..." }
    # Any student can apply. Requires staff approval.
    # """
    uid, role, _ = get_session_user(request)
    if not uid or role != 'student':
        return JsonResponse({'ok': False, 'error': 'Only students can apply.'}, status=403)

    try:
        student = Student.objects.get(pk=uid)
    except Student.DoesNotExist:
        return JsonResponse({'ok': False, 'error': 'Student not found.'}, status=403)

    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({'ok': False, 'error': 'Invalid data.'}, status=400)

    reason = data.get('reason', '').strip()
    if len(reason) < 30:
        return JsonResponse({'ok': False, 'error': 'Please write at least 30 characters.'}, status=400)

    if is_sc_moderator(student.user_id):
        return JsonResponse({'ok': False, 'error': 'You are already a moderator.'}, status=400)

    if SCModeratorApplication.objects.filter(student_user_id=student.user_id, status='pending').exists():
        return JsonResponse({'ok': False, 'error': 'You already have a pending application.'}, status=400)

    SCModeratorApplication.objects.create(
        student_user_id = student.user_id,
        student_name    = student.username,
        student_email   = student.email,
        reason          = reason,
        status          = 'pending',
    )
    return JsonResponse({'ok': True})


# ---------------------------------------------
#  STUDENT CENTER — staff management panel
# ---------------------------------------------

def sc_staff(request):
    # """
    # Staff-only view — manages:
    # - Moderator applications (approve / reject)
    # - Active moderators (revoke)
    # - All listings (remove violations)
    # - Event drop listing approval (if needed in future)
    # """
    uid, role, name = get_session_user(request)
    if not uid or role != 'staff':
        messages.error(request, 'Staff access required.')
        return redirect('login')

    pending_apps  = SCModeratorApplication.objects.filter(status='pending').order_by('-applied_at')
    all_apps      = SCModeratorApplication.objects.exclude(status='pending').order_by('-applied_at')[:20]
    moderators    = SCModerator.objects.filter(is_active=True).order_by('-granted_at')
    recent_listings = SCListing.objects.exclude(status='removed').order_by('-created_at')[:50]

    context = {
        'staff_name': name,
        'pending_apps':    pending_apps,
        'past_apps':       all_apps,
        'moderators':      moderators,
        'recent_listings': recent_listings,
    }
    return render(request, 'staff_student_center.html', context)


# ---------------------------------------------
#  STUDENT CENTER — review moderator application (staff)
# ---------------------------------------------

@require_POST
def sc_review_application(request):
    # """
    # POST /student-center/review-application/
    # JSON: { "app_id": 1, "action": "approve"|"reject", "note": "..." }
    # Staff only.
    # """
    uid, role, staff_name = get_session_user(request)
    if not uid or role != 'staff':
        return JsonResponse({'ok': False, 'error': 'Staff access required.'}, status=403)

    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({'ok': False, 'error': 'Invalid JSON.'}, status=400)

    app    = get_object_or_404(SCModeratorApplication, pk=data.get('app_id'))
    action = data.get('action', '')
    note   = data.get('note', '').strip()

    if action not in ('approve', 'reject'):
        return JsonResponse({'ok': False, 'error': 'Invalid action.'}, status=400)

    from django.utils import timezone
    app.reviewed_at  = timezone.now()
    app.reviewed_by  = staff_name

    if action == 'approve':
        app.status = 'approved'
        app.save()

        mod, created = SCModerator.objects.get_or_create(
            student_user_id=app.student_user_id,
            defaults={
                'student_name':    app.student_name,
                'student_email':   app.student_email,
                'granted_by':      staff_name,
                'application_id':  app.id,
                'is_active':       True,
            }
        )
        if not created:
            mod.is_active       = True
            mod.granted_by      = staff_name
            mod.application_id  = app.id
            mod.save()

        return JsonResponse({
            'ok':             True,
            'action':         'approved',
            'student_name':   app.student_name,
            'student_user_id': app.student_user_id,
        })

    else:  # reject
        app.status           = 'rejected'
        app.rejection_reason = note
        app.save()

        return JsonResponse({'ok': True, 'action': 'rejected'})


# ---------------------------------------------
#  STUDENT CENTER - revoke moderator  (staff)
# ---------------------------------------------

@require_POST
def sc_revoke_moderator(request):
    # """
    # POST /student-center/revoke-moderator/
    # JSON: { "mod_id": 1 }
    # """
    uid, role, staff_name = get_session_user(request)
    if not uid or role != 'staff':
        return JsonResponse({'ok': False, 'error': 'Staff access required.'}, status=403)

    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({'ok': False, 'error': 'Invalid JSON.'}, status=400)

    mod = get_object_or_404(SCModerator, pk=data.get('mod_id'))
    mod.is_active = False
    mod.save()

    return JsonResponse({'ok': True, 'student_name': mod.student_name})


# ---------------------------------------------
#  STUDENT CENTER - staff remove listing  (staff/mod)
# ---------------------------------------------

@require_POST
def sc_staff_remove_listing(request):
    # """
    # POST /student-center/staff-remove-listing/
    # JSON: { "listing_id": 1, "reason": "..." }
    # Staff or moderator only.
    # """
    uid, role, name = get_session_user(request)

    if not uid:
        return JsonResponse({'ok': False, 'error': 'Not authorized.'}, status=403)

    is_allowed = (role == 'staff')

    if not is_allowed and role == 'student':
        try:
            student = Student.objects.get(pk=uid)
            is_allowed = is_sc_moderator(student.user_id)
            name = student.username + ' (moderator)'
        except Student.DoesNotExist:
            pass

    if not is_allowed:
        return JsonResponse({'ok': False, 'error': 'Not authorized.'}, status=403)

    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({'ok': False, 'error': 'Invalid JSON.'}, status=400)

    listing = get_object_or_404(SCListing, pk=data.get('listing_id'))
    listing.status       = 'removed'
    listing.removed_by   = name
    listing.removed_note = data.get('reason', '').strip() or 'Removed by moderation'
    listing.save()

    return JsonResponse({'ok': True, 'listing_id': listing.id})


# ---------------------------------------------
#  STUDENT CENTER - contact seller (notif)
# ---------------------------------------------
@require_POST
def sc_contact_seller(request):
    uid, role, _ = get_session_user(request)
    if not uid or role != 'student':
        return JsonResponse({'ok': False, 'error': 'Not authorized.'}, status=403)

    try:
        data = json.loads(request.body)
        student = Student.objects.get(pk=uid)
        listing = SCListing.objects.get(pk=data.get('listing_id'))
    except (json.JSONDecodeError, ValueError, Student.DoesNotExist, SCListing.DoesNotExist):
        return JsonResponse({'ok': False, 'error': 'Invalid request.'}, status=400)

    # Don't let users contact themselves
    if listing.poster_user_id != student.user_id:
        Notification.objects.create(
            student_user_id=listing.poster_user_id,
            notif_type='sc_contacted',
            message=f"💬 {student.username} wants to contact you regarding your listing: {listing.title}.",
            link=f'/student-center/?action=view_contact&listing_id={listing.id}&buyer_id={student.user_id}' # <--- SMART LINK
        )
    return JsonResponse({'ok': True})


# ---------------------------------------------
#  STUDENT CENTER - seller processes buyer reaching out (responding to notif)
# ---------------------------------------------
@require_POST
def sc_get_user_card(request):
    """Fetches public info for the calling card/reserve review modal."""
    uid, role, _ = get_session_user(request)
    if not uid: return JsonResponse({'ok': False, 'error': 'Not authorized.'}, status=403)

    try:
        data = json.loads(request.body)
        buyer = Student.objects.get(user_id=data.get('buyer_id'))
        listing = SCListing.objects.get(pk=data.get('listing_id'))
        
        full_name = f"{buyer.first_name} {buyer.last_name}".strip()
        if not full_name: full_name = "No full name provided"

        return JsonResponse({
            'ok': True,
            'username': buyer.username,
            'email': buyer.email,
            'contact': buyer.contact_num or "No number provided",
            'full_name': full_name,
            'pfp': buyer.profile_picture_b64,
            'listing_title': listing.title
        })
    except (Student.DoesNotExist, SCListing.DoesNotExist):
        return JsonResponse({'ok': False, 'error': 'Data not found.'}, status=404)


# ---------------------------------------------
#  STUDENT CENTER - seller's respond 
# ---------------------------------------------
@require_POST
def sc_respond_reserve(request):
    """Handles Seller accepting or rejecting a reservation."""
    uid, role, name = get_session_user(request)
    if not uid: return JsonResponse({'ok': False, 'error': 'Not authorized.'}, status=403)

    try:
        data = json.loads(request.body)
        action = data.get('action') # 'accept' or 'reject'
        listing = SCListing.objects.get(pk=data.get('listing_id'))
        seller = Student.objects.get(pk=uid)
    except Exception:
        return JsonResponse({'ok': False, 'error': 'Invalid request.'}, status=400)

    # Ownership check
    if listing.poster_user_id != seller.user_id:
        return JsonResponse({'ok': False, 'error': 'Not your listing.'}, status=403)

    buyer_id = listing.reserved_by_user_id

    if action == 'accept':
        seller_contact = seller.contact_num or seller.email
        Notification.objects.create(
            student_user_id=buyer_id,
            notif_type='sc_reserved',
            message=f"✅ {seller.username} ACCEPTED your reservation for '{listing.title}'! Contact them at: {seller_contact}",
            link='/student-center/'
        )
        return JsonResponse({'ok': True, 'msg': 'Reservation accepted! Buyer has been notified with your contact info.'})
        
    elif action == 'reject':
        listing.status = 'available'
        listing.reserved_by_user_id = ''
        listing.reserved_by_name = ''
        listing.save()
        
        Notification.objects.create(
            student_user_id=buyer_id,
            notif_type='sc_reserved',
            message=f"❌ {seller.username} DECLINED your reservation for '{listing.title}'. The item is back to available.",
            link='/student-center/'
        )
        return JsonResponse({'ok': True, 'msg': 'Reservation declined. Item is available again.'})

# -------------------------------------------------------
#  NOTIFS - fetches  (AJAX GET)
# -------------------------------------------------------

def notifications_fetch(request):
    """
    GET /notifications/
    Called by navgo.js on every page load.
    Returns unread notifications for the logged-in student.
    Also auto-creates clinic reminder notifications for
    appointments happening tomorrow (Option A — on page load).

    Response:
    {
      "count": 3,
      "notifications": [
        {
          "id": 1,
          "type": "bao_restock",
          "message": "...",
          "link": "/bao/",
          "created_at": "May 1, 2025 · 09:32 AM"
        },
        ...
      ]
    }
    """
    from datetime import date as date_cls, timedelta

    uid, role, _ = get_session_user(request)

    if not uid or role != 'student':
        return JsonResponse({'count': 0, 'notifications': []})

    try:
        student = Student.objects.get(pk=uid)
    except Student.DoesNotExist:
        return JsonResponse({'count': 0, 'notifications': []})

    # ── Option A: auto-create clinic reminder if appt is tomorrow ──
    tomorrow = date_cls.today() + timedelta(days=1)
    upcoming = ClinicAppointment.objects.filter(
        student_user_id=student.user_id,
        appt_date=tomorrow,
        status='confirmed'
    )
    for appt in upcoming:
        # Only create if we haven't already reminded them for this appt
        already = Notification.objects.filter(
            student_user_id=student.user_id,
            notif_type='clinic',
            message__icontains=appt.appt_number,
            is_read=False
        ).exists()
        if not already:
            svc_label = appt.get_service_label()
            Notification.objects.create(
                student_user_id=student.user_id,
                notif_type='clinic',
                message=f'Reminder: You have a {svc_label} appointment TOMORROW ({appt.time_slot}). Appt #{appt.appt_number} — bring your slip!',
                link='/clinic/',
            )

    # ── Return recent notifications (BOTH read and unread) ──────────────────────
    notifs = Notification.objects.filter(
        student_user_id=student.user_id
    ).order_by('-created_at')[:20]

    data = []
    for n in notifs:
        data.append({
            'id':         n.id,
            'type':       n.notif_type,
            'message':    n.message,
            'link':       n.link,
            'is_read':    n.is_read, # <--- NEW: Tells JS if it's read
            'created_at': n.created_at.strftime('%b %d · %I:%M %p'),
        })

    return JsonResponse({'count': len([n for n in notifs if not n.is_read]), 'notifications': data})



# -------------------------------------------------------
#  NOTIFS - marking as read (AJAX POST)
# -------------------------------------------------------
@require_POST
def notifications_mark_read(request):
    """
    POST /notifications/mark-read/
    JSON body: { "id": 1 }      → marks one notification as read
               { "id": "all" }  → marks all as read
    """
    uid, role, _ = get_session_user(request)
    if not uid or role != 'student':
        return JsonResponse({'ok': False, 'error': 'Not authorized.'}, status=403)

    try:
        student = Student.objects.get(pk=uid)
    except Student.DoesNotExist:
        return JsonResponse({'ok': False, 'error': 'Student not found.'}, status=403)

    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({'ok': False, 'error': 'Invalid JSON.'}, status=400)

    notif_id = data.get('id')

    if notif_id == 'all':
        Notification.objects.filter(
            student_user_id=student.user_id,
            is_read=False
        ).update(is_read=True)
        return JsonResponse({'ok': True, 'marked': 'all'})

    try:
        notif = Notification.objects.get(
            pk=notif_id,
            student_user_id=student.user_id
        )
        notif.is_read = True
        notif.save()
        return JsonResponse({'ok': True, 'marked': notif.id})
    except Notification.DoesNotExist:
        return JsonResponse({'ok': False, 'error': 'Notification not found.'}, status=404)
    

@require_POST
def update_profile(request):
    uid, role, _ = get_session_user(request)
    if not uid or role != 'student':
        return JsonResponse({'ok': False, 'error': 'Not authorized.'}, status=403)

    try:
        data = json.loads(request.body)
        student = Student.objects.get(pk=uid)
    except (json.JSONDecodeError, ValueError, Student.DoesNotExist):
        return JsonResponse({'ok': False, 'error': 'Invalid request.'}, status=400)

    # 1. Handle Password Change (if user typed something in)
    cur_pw = data.get('curPw', '')
    new_pw = data.get('newPw', '')
    conf_pw = data.get('confPw', '')

    if cur_pw or new_pw or conf_pw:
        if cur_pw != student.password:
            return JsonResponse({'ok': False, 'error': 'Current password is incorrect.'}, status=400)
        if new_pw != conf_pw:
            return JsonResponse({'ok': False, 'error': 'New passwords do not match.'}, status=400)
        if len(new_pw) < 8:
            return JsonResponse({'ok': False, 'error': 'Password must be at least 8 characters.'}, status=400)
        
        student.password = new_pw

    # 2. Update Profile Data
    try:
        student.year_level = int(data.get('yearLevel', student.year_level))
    except ValueError:
        pass # Ignore if they somehow sent non-numeric data
        
    student.course = data.get('course', student.course).strip()
    student.section = data.get('section', student.section).strip()
    student.first_name = data.get('firstName', student.first_name).strip()
    student.last_name = data.get('lastName', student.last_name).strip()
    student.contact_num = data.get('contactNum', student.contact_num).strip()

    new_pfp = data.get('pfp')
    if new_pfp:
        student.profile_picture_b64 = new_pfp

    student.save()

    return JsonResponse({'ok': True, 'message': 'Profile saved successfully!'})