from django import forms 
from .models import Student, Staff

class StudentForm(forms.ModelForm):
    class Meta:
        model = Student
        fields = ['username', 'user_id', 'email', 'password']


class StaffForm(forms.ModelForm):
    class Meta:
        model = Staff
        fields = ['fname', 'lname', 'user_id', 'email', 'password']