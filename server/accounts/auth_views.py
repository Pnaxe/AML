from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework import status
from django.contrib.auth import get_user_model
from django.contrib.auth import update_session_auth_hash

User = get_user_model()

@api_view(['GET'])
@permission_classes([AllowAny])  # Using AllowAny but checking auth manually due to DRF settings
def current_user(request):
    """
    Get current logged-in user information
    Returns user details if authenticated, otherwise returns 401
    """
    if not request.user.is_authenticated:
        return Response(
            {'error': 'Authentication required'},
            status=status.HTTP_401_UNAUTHORIZED
        )
    
    user = request.user
    return Response({
        'id': user.id,
        'username': user.username,
        'email': user.email,
        'first_name': user.first_name or '',
        'last_name': user.last_name or '',
        'name': f'{user.first_name} {user.last_name}'.strip() or user.username,
        'is_staff': user.is_staff,
        'is_superuser': user.is_superuser,
        'role': getattr(user, 'role', 'VIEWER'),  # Get role from CustomUser model
    })

@api_view(['POST'])
@permission_classes([AllowAny])  # Using AllowAny but checking auth manually due to DRF settings
def change_password(request):
    """
    Change password for the current authenticated user
    Requires: current_password, new_password
    """
    if not request.user.is_authenticated:
        return Response(
            {'error': 'Authentication required'},
            status=status.HTTP_401_UNAUTHORIZED
        )
    
    user = request.user
    current_password = request.data.get('current_password')
    new_password = request.data.get('new_password')
    
    if not current_password or not new_password:
        return Response(
            {'error': 'Current password and new password are required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Verify current password
    if not user.check_password(current_password):
        return Response(
            {'error': 'Current password is incorrect'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Validate new password
    if len(new_password) < 8:
        return Response(
            {'error': 'New password must be at least 8 characters long'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Set new password
    user.set_password(new_password)
    user.save()
    
    # Update session to prevent logout
    update_session_auth_hash(request, user)
    
    return Response({
        'message': 'Password changed successfully'
    }, status=status.HTTP_200_OK)

