import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Check,
  Plus,
  Trash2,
  Copy,
  RotateCcw,
  FileText,
  ChevronRight,
  ChevronDown,
  Sliders,
  Settings,
  User,
  Shuffle,
  Search,
  AlertCircle,
  Sparkles,
  Info,
  Calendar,
  Share2,
  ListFilter,
  CheckCircle2,
  ArrowRight,
  UserPlus,
  Upload,
  Download,
  Lock,
  Unlock,
  Shield,
  ShieldAlert,
  LogOut,
  Key,
  UserX,
  Fingerprint,
  Edit2
} from 'lucide-react';

import { IAMUser } from './types';
import { collection, doc, getDocs, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';

import {
  DEFAULT_PLAYERS_CSV,
  parsePlayersCsv,
  fuzzyMatchPlayer,
  getMatchDetails,
  parsePastedAttendees,
  Player,
  POSITION_LABELS,
  POSITION_FIELDS,
  PositionKey,
  serializePlayersToCsv
} from './playersData';

import {
  generateBalancedTeams,
  calculateTeamMetrics,
  getTeamSuggestions,
  getPlayerRole,
  Team,
  TeamMetrics,
  PlayerRole
} from './balancer';

import { ClubLogo, ClubBanner } from './components/ClubLogo';

// Demo selection list from the prompt image
const DEMO_ATTENDEES_RAW = `Cristiano Miries
Jayson Mehra
Kaiser Af
Mikail Shahid
Rafael Miries
Other Child
Lee Siqi
Keke Do You Love Me
Chris P
Raf Mukadam
Hilli .
Maroon Maroon
Keylor M. M.
Jofa Am +1 Of Rohit
Steven Attwell
Mo Khoshkhoo
Ladykiler Rit
Ballack Tantrum
Ronald Batista
Big_Toe Yad
Mr_Whiskey Deo`;

// Permanent team-wide role-based credentials hardcoded in the application files for seamless consistency across multiple machines and users
const STATIC_IAM_ROSTER: IAMUser[] = [
  {
    id: 'admin-master',
    name: 'Master Admin',
    pin: '123456',
    role: 'Master Admin',
    createdAt: '2026-05-25T00:00:00.000Z'
  },
  {
    id: 'admin-coor',
    name: 'Admin Coordinator',
    pin: '654321',
    role: 'Admin',
    createdAt: '2026-05-25T00:00:00.000Z'
  },
  {
    id: 'player-read-only',
    name: 'Standard Player',
    pin: '111111',
    role: 'User',
    createdAt: '2026-05-25T00:00:00.000Z'
  }
];

export default function App() {
  // --- Persistent LocalState ---
  const [csvContent, setCsvContent] = useState<string>(() => {
    return localStorage.getItem('bt_players_csv') || DEFAULT_PLAYERS_CSV;
  });

  const [rawAttendeesText, setRawAttendeesText] = useState<string>(() => {
    return localStorage.getItem('bt_pasted_attendees') || DEMO_ATTENDEES_RAW;
  });

  const [nameMappings, setNameMappings] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('bt_name_mappings');
    return saved ? JSON.parse(saved) : {};
  });

  const [customGuests, setCustomGuests] = useState<Player[]>(() => {
    const saved = localStorage.getItem('bt_custom_guests');
    return saved ? JSON.parse(saved) : [];
  });

  const [selectedNumTeams, setSelectedNumTeams] = useState<number>(() => {
    const saved = localStorage.getItem('bt_num_teams');
    return saved ? parseInt(saved, 10) : 3;
  });

  // --- Dynamic App UI State ---
  const [activeTab, setActiveTab] = useState<'picker' | 'database' | 'security'>('picker');
  
  // --- Local IAM State ---
  const [iamUsers, setIamUsers] = useState<IAMUser[]>(STATIC_IAM_ROSTER);
  const [hasLoadedFromServer, setHasLoadedFromServer] = useState(false);

  const [currentUser, setCurrentUser] = useState<IAMUser | null>(() => {
    const saved = sessionStorage.getItem('bt_iam_current_user');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as IAMUser;
        return parsed;
      } catch (e) {
        console.error('Error parsing current IAM user:', e);
      }
    }
    return null;
  });

  // PIN inputs / login screen local states
  const [loginSelectedUserId, setLoginSelectedUserId] = useState<string>('admin-master');
  const [loginPin, setLoginPin] = useState<string>('');
  const [loginError, setLoginError] = useState<string | null>(null);

  // New User Creation state inside Access Control
  const [newUserName, setNewUserName] = useState<string>('');
  const [newUserPin, setNewUserPin] = useState<string>('');
  const [newUserRole, setNewUserRole] = useState<'Master Admin' | 'Admin' | 'User'>('User');
  const [newUserError, setNewUserError] = useState<string | null>(null);

  // Password editing state for active admin
  const [changePinOld, setChangePinOld] = useState<string>('');
  const [changePinNew, setChangePinNew] = useState<string>('');
  const [changePinConfirm, setChangePinConfirm] = useState<string>('');

  // PIN reset modal action states
  const [pinResetUserId, setPinResetUserId] = useState<string | null>(null);
  const [resetPinValue, setResetPinValue] = useState<string>('');
  const [resetPinError, setResetPinError] = useState<string | null>(null);
  const [changePinSuccess, setChangePinSuccess] = useState<string | null>(null);
  const [changePinError, setChangePinError] = useState<string | null>(null);

  // Name editing and rename states
  const [ownNameValue, setOwnNameValue] = useState<string>('');
  const [ownNameError, setOwnNameError] = useState<string | null>(null);
  const [ownNameSuccess, setOwnNameSuccess] = useState<string | null>(null);

  const [renameUserId, setRenameUserId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState<string>('');
  const [renameError, setRenameError] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser) {
      setOwnNameValue(currentUser.name);
    } else {
      setOwnNameValue('');
    }
    setOwnNameError(null);
    setOwnNameSuccess(null);
  }, [currentUser]);

  // Load IAM data & Player configuration from Firestore on startup
  useEffect(() => {
    let active = true;

    async function loadInitialData() {
      try {
        // 1. Fetch IAM Users
        const usersSnapshot = await getDocs(collection(db, "iam_users"));
        let usersList: IAMUser[] = [];
        
        usersSnapshot.forEach((docSnap) => {
          usersList.push(docSnap.data() as IAMUser);
        });

        // If the database has no registered users yet, seed it with the default static roster
        if (usersList.length === 0) {
          console.log("Seeding Firestore with default master roster...");
          for (const user of STATIC_IAM_ROSTER) {
            await setDoc(doc(db, "iam_users", user.id), user);
            usersList.push(user);
          }
        }

        if (active) {
          setIamUsers(usersList);
          setHasLoadedFromServer(true);
        }

        // 2. Fetch Player Configuration Settings
        const playerDocRef = doc(db, "settings", "players");
        const playerDocSnap = await getDoc(playerDocRef);

        if (playerDocSnap.exists()) {
          const pData = playerDocSnap.data();
          if (active) {
            if (pData.csvContent !== undefined) setCsvContent(pData.csvContent);
            if (pData.rawAttendeesText !== undefined) setRawAttendeesText(pData.rawAttendeesText);
            if (pData.nameMappings !== undefined) setNameMappings(pData.nameMappings);
            if (pData.customGuests !== undefined) setCustomGuests(pData.customGuests);
            if (pData.selectedNumTeams !== undefined) setSelectedNumTeams(pData.selectedNumTeams);
          }
        } else {
          // If Firestore configuration is empty, seed it with the local defaults / localStorage cache
          console.log("No remote configurations found. Seeding remote settings/players with current/local state...");
          const initialPayload = {
            csvContent: localStorage.getItem('bt_players_csv') || DEFAULT_PLAYERS_CSV,
            rawAttendeesText: localStorage.getItem('bt_pasted_attendees') || DEMO_ATTENDEES_RAW,
            nameMappings: (() => {
              const saved = localStorage.getItem('bt_name_mappings');
              return saved ? JSON.parse(saved) : {};
            })(),
            customGuests: (() => {
              const saved = localStorage.getItem('bt_custom_guests');
              return saved ? JSON.parse(saved) : [];
            })(),
            selectedNumTeams: (() => {
              const saved = localStorage.getItem('bt_num_teams');
              return saved ? parseInt(saved, 10) : 3;
            })(),
            updatedAt: new Date().toISOString()
          };
          await setDoc(playerDocRef, initialPayload);
        }
      } catch (err) {
        console.error("Error reading database configurations from Firestore:", err);
        if (active) {
          setHasLoadedFromServer(true);
        }
      }
    }

    loadInitialData();

    return () => {
      active = false;
    };
  }, []);

  // Save IAM data to Firestore on update
  useEffect(() => {
    if (!hasLoadedFromServer) return;

    async function syncIamUsersToFirestore() {
      try {
        // Write/Update all active users in state
        for (const user of iamUsers) {
          await setDoc(doc(db, "iam_users", user.id), user);
        }

        // Clean up retired users from Firestore that are no longer in our iamUsers list
        const usersSnapshot = await getDocs(collection(db, "iam_users"));
        const activeIds = new Set(iamUsers.map(u => u.id));
        
        for (const docSnap of usersSnapshot.docs) {
          if (!activeIds.has(docSnap.id)) {
            await deleteDoc(doc(db, "iam_users", docSnap.id));
          }
        }
      } catch (err) {
        console.error("Error synchronizing iamUsers list to Firestore:", err);
      }
    }

    syncIamUsersToFirestore();
  }, [iamUsers, hasLoadedFromServer]);

  // Save Player Configurations to Firestore on update (1-second debounce to batch rapid changes)
  useEffect(() => {
    if (!hasLoadedFromServer) return;

    const delayDebounceFn = setTimeout(async () => {
      try {
        await setDoc(doc(db, "settings", "players"), {
          csvContent,
          rawAttendeesText,
          nameMappings,
          customGuests,
          selectedNumTeams,
          updatedAt: new Date().toISOString()
        });
        console.log("Player configuration synced to Firestore successfully.");
      } catch (err) {
        console.error("Error saving player credentials to Firestore:", err);
      }
    }, 1000);

    return () => clearTimeout(delayDebounceFn);
  }, [csvContent, rawAttendeesText, nameMappings, customGuests, selectedNumTeams, hasLoadedFromServer]);

  // Handle active session sync and verification
  useEffect(() => {
    if (currentUser) {
      const activeMatch = iamUsers.find(u => u.id === currentUser.id);
      if (activeMatch) {
        if (activeMatch.pin !== currentUser.pin || activeMatch.role !== currentUser.role || activeMatch.name !== currentUser.name) {
          setCurrentUser(activeMatch);
        }
      } else {
        // Log out immediately if the active user profile is deleted/revoked from directory
        setCurrentUser(null);
      }
    }
  }, [iamUsers, currentUser]);

  useEffect(() => {
    if (currentUser) {
      sessionStorage.setItem('bt_iam_current_user', JSON.stringify(currentUser));
    } else {
      sessionStorage.removeItem('bt_iam_current_user');
    }
  }, [currentUser]);

  // Modern Alert/Confirm Dialog Modal state to bypass iframe restrictions
  const [dialogConfig, setDialogConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'alert' | 'confirm';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'alert',
    onConfirm: () => {}
  });

  const showCustomAlert = (title: string, message: string) => {
    setDialogConfig({
      isOpen: true,
      title,
      message,
      type: 'alert',
      onConfirm: () => {}
    });
  };

  const showCustomConfirm = (title: string, message: string, onConfirm: () => void) => {
    setDialogConfig({
      isOpen: true,
      title,
      message,
      type: 'confirm',
      onConfirm: () => {
        onConfirm();
        setDialogConfig(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  // Auth operations
  const handleLogin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const user = iamUsers.find(u => u.id === loginSelectedUserId);
    if (!user) {
      setLoginError('Selected user profile not found.');
      return;
    }
    if (user.pin !== loginPin) {
      setLoginError('Incorrect passcode PIN. Please try again.');
      return;
    }
    // Succeeded!
    setCurrentUser(user);
    setLoginPin('');
    setLoginError(null);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setActiveTab('picker');
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    setNewUserError(null);
    const nameTrimmed = newUserName.trim();
    const pinMod = newUserPin.trim();

    if (!nameTrimmed) {
      setNewUserError('Please provide a profile name (e.g. "Lee Siqi").');
      return;
    }

    if (pinMod.length !== 6) {
      setNewUserError('Passcode PIN must contain exactly 6 numerical digits.');
      return;
    }

    if (!/^\d+$/.test(pinMod)) {
      setNewUserError('Passcode PIN must contain numerical digits only.');
      return;
    }

    // Prevent duplicate name
    const isDuplicate = iamUsers.some(u => u.name.toLowerCase() === nameTrimmed.toLowerCase());
    if (isDuplicate) {
      setNewUserError('A registered profile with that exact name already exists.');
      return;
    }

    const newUser: IAMUser = {
      id: 'user-' + Date.now(),
      name: nameTrimmed,
      pin: pinMod,
      role: newUserRole,
      createdAt: new Date().toISOString()
    };

    setIamUsers(prev => [...prev, newUser]);
    setNewUserName('');
    setNewUserPin('');
    setNewUserRole('User');
    showCustomAlert('Profile Registered', `Successfully registered new ${newUserRole} profile: "${nameTrimmed}" with PIN passcode "${pinMod}".`);
  };

  const handleDeleteUser = (userIdToDelete: string) => {
    if (userIdToDelete === 'admin-master') {
      showCustomAlert('Access Restricted', 'The canonical Master Admin profile cannot be removed.');
      return;
    }
    if (currentUser && currentUser.id === userIdToDelete) {
      showCustomAlert('Active Profile', 'You are currently logged into this profile. Logout or change accounts to delete.');
      return;
    }
    const userToDelete = iamUsers.find(u => u.id === userIdToDelete);
    if (!userToDelete) return;

    // Reject removing static hardcoded users through the UI
    const isStatic = STATIC_IAM_ROSTER.some(u => u.id === userIdToDelete);
    if (isStatic) {
      showCustomAlert(
        'System Lock',
        `The profile "${userToDelete.name}" is hardcoded as part of the permanent team-wide roster (STATIC_IAM_ROSTER) inside App.tsx.\n\nTo remove or edit this user permanently, please edit the application source files directly.`
      );
      return;
    }

    // Privilege checks
    if (currentUser?.role !== 'Master Admin') {
      // Standard Admin can only delete Users and other Admins, NOT Master Admin
      if (userToDelete.role === 'Master Admin') {
        showCustomAlert('Access Denied', 'Coordinators are blocked from revoking Master Admin profiles. Only a Master Admin user can revoke root credentials.');
        return;
      }
    }

    showCustomConfirm(
      'Revoke Roster Credentials',
      `Are you absolutely sure you want to revoke access and delete user credentials for "${userToDelete.name}"?`,
      () => {
        setIamUsers(prev => prev.filter(u => u.id !== userIdToDelete));
      }
    );
  };

  const handleOpenPinReset = (userId: string) => {
    const targetUser = iamUsers.find(u => u.id === userId);
    if (!targetUser) return;

    if (currentUser?.role === 'User') {
      showCustomAlert('Access Denied', 'Standard users are blocked from reconfiguring system credentials.');
      return;
    }

    if (targetUser.role === 'Master Admin') {
      if (currentUser?.role !== 'Master Admin') {
        showCustomAlert('Access Denied', 'Admin coordinators are blocked from resetting Master Admin passcode credentials.');
        return;
      }
    }

    setPinResetUserId(userId);
    setResetPinValue('');
    setResetPinError(null);
  };

  const handleApplyPinReset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinResetUserId) return;

    const targetUser = iamUsers.find(u => u.id === pinResetUserId);
    if (!targetUser) return;

    const pinTrimmed = resetPinValue.trim().replace(/\D/g, '');
    if (pinTrimmed.length !== 6) {
      setResetPinError('Passcode PIN must contain exactly 6 numerical digits.');
      return;
    }

    setIamUsers(prev => prev.map(u => u.id === pinResetUserId ? { ...u, pin: pinTrimmed } : u));
    setPinResetUserId(null);
    showCustomAlert('Success', `Security passcode credentials for "${targetUser.name}" have been updated successfully to [ ${pinTrimmed} ]!`);
  };

  const canRenameUser = (targetUser: IAMUser) => {
    if (!currentUser) return false;
    const isSelf = currentUser.id === targetUser.id;
    if (isSelf) return true; // Change personal IAM Member profile name is Allowed for all.

    // Dealing with OTHERS:
    if (currentUser.role === 'User') {
      return false; // User (Standard Player) is Blocked from changing other profiles
    }

    if (currentUser.role === 'Admin') {
      // Admin is Allowed to change other Member profile names, EXCEPT Master Admin.
      if (targetUser.role === 'Master Admin') return false;
      return true;
    }

    if (currentUser.role === 'Master Admin') {
      // Master Admin is Allowed to change all profile names
      return true;
    }

    return false;
  };

  const canModifyRole = (targetUser: IAMUser) => {
    if (!currentUser) return false;
    
    // Changing own role is generally blocked to prevent lockouts
    if (currentUser.id === targetUser.id) return false;

    if (currentUser.role === 'User') {
      return false; // User (Standard Player) is Blocked from all role modifications
    }

    if (currentUser.role === 'Admin') {
      // Admin is Allowed to change other Member role privileges (excl. Master Admin)
      // They are Blocked from changing Master Admin's role privileges
      if (targetUser.role === 'Master Admin') return false;
      return true;
    }

    if (currentUser.role === 'Master Admin') {
      // Master Admin is Allowed to change other Master Admin or standard Member roles
      return true;
    }

    return false;
  };

  const handleUpdateUserRole = (userId: string, newRole: 'Master Admin' | 'Admin' | 'User') => {
    const targetUser = iamUsers.find(u => u.id === userId);
    if (!targetUser) return;

    if (!canModifyRole(targetUser)) {
      showCustomAlert('Access Denied', 'You do not have privilege permissions to change this profile role.');
      return;
    }

    // Double check specific permissions
    if (newRole === 'Master Admin' && currentUser?.role !== 'Master Admin') {
      showCustomAlert('Access Denied', 'Only a Master Admin can promote other members to the root Master Admin group.');
      return;
    }

    setIamUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    showCustomAlert('Success', `Role privilege for "${targetUser.name}" has been successfully changed to "${newRole}".`);
  };

  const handleOpenRename = (userId: string) => {
    const targetUser = iamUsers.find(u => u.id === userId);
    if (!targetUser) return;

    if (!canRenameUser(targetUser)) {
      showCustomAlert('Access Denied', 'You do not have privilege permissions to edit this profile name.');
      return;
    }

    setRenameUserId(userId);
    setRenameValue(targetUser.name);
    setRenameError(null);
  };

  const handleApplyRename = (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameUserId) return;

    const targetUser = iamUsers.find(u => u.id === renameUserId);
    if (!targetUser) return;

    if (!canRenameUser(targetUser)) {
      setRenameError('You do not have permission to rename this profile.');
      return;
    }

    const nameTrimmed = renameValue.trim();
    if (!nameTrimmed) {
      setRenameError('Name cannot be empty.');
      return;
    }

    const isDuplicate = iamUsers.some(u => u.id !== renameUserId && u.name.toLowerCase() === nameTrimmed.toLowerCase());
    if (isDuplicate) {
      setRenameError('A registered profile with that exact name already exists.');
      return;
    }

    // Apply rename in roster
    setIamUsers(prev => prev.map(u => u.id === renameUserId ? { ...u, name: nameTrimmed } : u));
    
    // If we renamed ourselves from the directory, update the active session too!
    if (currentUser && currentUser.id === renameUserId) {
      setCurrentUser(prev => prev ? { ...prev, name: nameTrimmed } : null);
    }

    setRenameUserId(null);
    showCustomAlert('Success', `Member profile name has been successfully updated to "${nameTrimmed}".`);
  };

  const handleUpdateOwnName = (e: React.FormEvent) => {
    e.preventDefault();
    setOwnNameError(null);
    setOwnNameSuccess(null);

    if (!currentUser) return;

    const nameTrimmed = ownNameValue.trim();
    if (!nameTrimmed) {
      setOwnNameError('Profile name cannot be empty.');
      return;
    }

    // Duplicate check
    const isDuplicate = iamUsers.some(u => u.id !== currentUser.id && u.name.toLowerCase() === nameTrimmed.toLowerCase());
    if (isDuplicate) {
      setOwnNameError('A registered profile with that exact name already exists.');
      return;
    }

    // Update in roster list
    setIamUsers(prev => prev.map(u => u.id === currentUser.id ? { ...u, name: nameTrimmed } : u));

    // Update session
    setCurrentUser(prev => prev ? { ...prev, name: nameTrimmed } : null);

    setOwnNameSuccess('Your profile name was successfully updated!');
  };

  const handleChangeOwnPin = (e: React.FormEvent) => {
    e.preventDefault();
    setChangePinError(null);
    setChangePinSuccess(null);

    if (!currentUser) return;

    const oldPinTrimmed = changePinOld.trim();
    const newPinTrimmed = changePinNew.trim();
    const confirmPinTrimmed = changePinConfirm.trim();

    if (currentUser.pin !== oldPinTrimmed) {
      setChangePinError('The current PIN entered is incorrect.');
      return;
    }

    if (newPinTrimmed.length !== 6) {
      setChangePinError('New PIN must be exactly 6 digits.');
      return;
    }

    if (!/^\d+$/.test(newPinTrimmed)) {
      setChangePinError('New PIN must contain digits only.');
      return;
    }

    if (newPinTrimmed !== confirmPinTrimmed) {
      setChangePinError('New PIN and confirmation PIN do not match.');
      return;
    }

    // Update in list
    setIamUsers(prev => {
      const updated = prev.map(u => {
        if (u.id === currentUser!.id) {
          return { ...u, pin: newPinTrimmed };
        }
        return u;
      });
      return updated;
    });

    // Update active session too
    setCurrentUser(prev => prev ? { ...prev, pin: newPinTrimmed } : null);

    setChangePinOld('');
    setChangePinNew('');
    setChangePinConfirm('');
    setChangePinSuccess('Your security passcode was successfully updated!');
  };

  // Stats & trait editing states
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [isAddingPlayer, setIsAddingPlayer] = useState<boolean>(false);

  // Stats edit form fields
  const [formSurname, setFormSurname] = useState<string>('');
  const [formFirstName, setFormFirstName] = useState<string>('');
  const [formGoalkeeper, setFormGoalkeeper] = useState<number>(70);
  const [formRightBack, setFormRightBack] = useState<number>(70);
  const [formLeftBack, setFormLeftBack] = useState<number>(70);
  const [formCentreBack, setFormCentreBack] = useState<number>(70);
  const [formDefensiveMidfielder, setFormDefensiveMidfielder] = useState<number>(70);
  const [formMidfielder, setFormMidfielder] = useState<number>(70);
  const [formAttackingMidfielder, setFormAttackingMidfielder] = useState<number>(70);
  const [formWinger, setFormWinger] = useState<number>(70);
  const [formStriker, setFormStriker] = useState<number>(70);
  const [formStamina, setFormStamina] = useState<number>(70);
  const [formPositiveAttribute, setFormPositiveAttribute] = useState<string>('');
  const [formNegativeAttribute, setFormNegativeAttribute] = useState<string>('');

  const startEditingPlayer = (player: Player) => {
    setEditingPlayer(player);
    setIsAddingPlayer(false);
    setFormSurname(player.surname);
    setFormFirstName(player.firstName);
    setFormGoalkeeper(player.goalkeeper ?? 70);
    setFormRightBack(player.rightBack ?? 70);
    setFormLeftBack(player.leftBack ?? 70);
    setFormCentreBack(player.centreBack ?? 70);
    setFormDefensiveMidfielder(player.defensiveMidfielder ?? 70);
    setFormMidfielder(player.midfielder ?? 70);
    setFormAttackingMidfielder(player.attackingMidfielder ?? 70);
    setFormWinger(player.winger ?? 70);
    setFormStriker(player.striker ?? 70);
    setFormStamina(player.stamina ?? 70);
    setFormPositiveAttribute(player.positiveAttribute ?? '');
    setFormNegativeAttribute(player.negativeAttribute ?? '');
  };

  const startAddingPlayer = () => {
    setEditingPlayer(null);
    setIsAddingPlayer(true);
    setFormSurname('');
    setFormFirstName('');
    setFormGoalkeeper(70);
    setFormRightBack(70);
    setFormLeftBack(70);
    setFormCentreBack(70);
    setFormDefensiveMidfielder(70);
    setFormMidfielder(70);
    setFormAttackingMidfielder(70);
    setFormWinger(70);
    setFormStriker(70);
    setFormStamina(70);
    setFormPositiveAttribute('');
    setFormNegativeAttribute('');
  };

  const handleSavePlayerDetails = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formFirstName.trim() && !formSurname.trim()) {
      showCustomAlert('Required Fields', 'First name or Surname is required.');
      return;
    }

    try {
      if (editingPlayer) {
        // Update existing player
        const updatedPlayers = databasePlayers.map((p, idx) => {
          if (p.id === editingPlayer.id) {
            return {
              ...p,
              surname: formSurname.trim(),
              firstName: formFirstName.trim(),
              goalkeeper: formGoalkeeper,
              rightBack: formRightBack,
              leftBack: formLeftBack,
              centreBack: formCentreBack,
              defensiveMidfielder: formDefensiveMidfielder,
              midfielder: formMidfielder,
              attackingMidfielder: formAttackingMidfielder,
              winger: formWinger,
              striker: formStriker,
              stamina: formStamina,
              positiveAttribute: formPositiveAttribute.trim(),
              negativeAttribute: formNegativeAttribute.trim()
            } as Player;
          }
          return p;
        });

        const newCsv = serializePlayersToCsv(updatedPlayers);
        setCsvContent(newCsv);
        setEditingPlayer(null);
        showCustomAlert('Member Profile Saved', `Player info for "${formFirstName.trim()} ${formSurname.trim()}" successfully saved!`);
      } else if (isAddingPlayer) {
        // Create a new player
        const newPlayer: Player = {
          id: `${formSurname.trim().replace(/[^a-zA-Z0-9]/g, '')}_${formFirstName.trim().replace(/[^a-zA-Z0-9]/g, '')}_${databasePlayers.length + 1}`,
          surname: formSurname.trim(),
          firstName: formFirstName.trim(),
          goalkeeper: formGoalkeeper,
          rightBack: formRightBack,
          leftBack: formLeftBack,
          centreBack: formCentreBack,
          defensiveMidfielder: formDefensiveMidfielder,
          midfielder: formMidfielder,
          attackingMidfielder: formAttackingMidfielder,
          winger: formWinger,
          striker: formStriker,
          stamina: formStamina,
          positiveAttribute: formPositiveAttribute.trim(),
          negativeAttribute: formNegativeAttribute.trim(),
          fullName: formSurname.trim() && formFirstName.trim()
            ? (formSurname.trim() === '.' ? formFirstName.trim() : `${formFirstName.trim()} ${formSurname.trim()}`)
            : (formFirstName.trim() || formSurname.trim()),
          bestRating: 70,
          bestPosition: 'Midfielder'
        };

        const updatedPlayers = [...databasePlayers, newPlayer];
        const newCsv = serializePlayersToCsv(updatedPlayers);
        setCsvContent(newCsv);
        setIsAddingPlayer(false);
        showCustomAlert('Profile Added', `New player "${formFirstName.trim()} ${formSurname.trim()}" successfully added!`);
      }
    } catch (err: any) {
      showCustomAlert('Database Integrity Error', `Error saving player credentials: ${err.message}`);
    }
  };

  const handleDeletePlayerFromMatrix = (playerId: string, fullName: string) => {
    if (currentUser?.role !== 'Master Admin' && currentUser?.role !== 'Admin') {
      showCustomAlert('Access Denied', 'Database credentials restricted. Only Master Admins or Admins can purge player records.');
      return;
    }

    showCustomConfirm(
      'Purge Player Profile',
      `Are you absolutely sure you want to permanently delete player "${fullName}" from the tactical ratings matrix?`,
      () => {
        const updatedPlayers = databasePlayers.filter(p => p.id !== playerId);
        const newCsv = serializePlayersToCsv(updatedPlayers);
        setCsvContent(newCsv);
        setCsvEditValue(newCsv);
        showCustomAlert('Success', `Player profile for "${fullName}" was successfully removed.`);
      }
    );
  };

  const [csvEditValue, setCsvEditValue] = useState<string>(csvContent);
  const [dbSearch, setDbSearch] = useState<string>('');
  const [isCsvModified, setIsCsvModified] = useState<boolean>(false);
  const [generatedTeams, setGeneratedTeams] = useState<Team[]>([]);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  
  // Manual move/swap state
  const [activeSwapPlayerId, setActiveSwapPlayerId] = useState<{ teamId: number; playerId: string } | null>(null);

  // CSV Drag and Drop states
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Parse Main Players Database from CSV state
  const databasePlayers = useMemo(() => {
    try {
      return parsePlayersCsv(csvContent);
    } catch (e) {
      console.error('Error parsing CSV database:', e);
      return [];
    }
  }, [csvContent]);

  // Sync CSV editor value when state updates
  useEffect(() => {
    setCsvEditValue(csvContent);
  }, [csvContent]);

  // Persistent synchronizations
  useEffect(() => {
    localStorage.setItem('bt_players_csv', csvContent);
  }, [csvContent]);

  useEffect(() => {
    localStorage.setItem('bt_pasted_attendees', rawAttendeesText);
  }, [rawAttendeesText]);

  useEffect(() => {
    localStorage.setItem('bt_name_mappings', JSON.stringify(nameMappings));
  }, [nameMappings]);

  useEffect(() => {
    localStorage.setItem('bt_custom_guests', JSON.stringify(customGuests));
  }, [customGuests]);

  useEffect(() => {
    localStorage.setItem('bt_num_teams', selectedNumTeams.toString());
  }, [selectedNumTeams]);

  // Combine database players + custom guests
  const allAvailablePlayers = useMemo(() => {
    return [...databasePlayers, ...customGuests];
  }, [databasePlayers, customGuests]);

  // Parse list of parsed raw names from pasted text
  const parsedAttendeeNames = useMemo(() => {
    return parsePastedAttendees(rawAttendeesText);
  }, [rawAttendeesText]);

  // Resolve matching for all current text attendees
  const resolvedAttendeesResult = useMemo(() => {
    const matched: Player[] = [];
    const unmatched: string[] = [];
    const uncertain: Array<{ rawName: string; player: Player; score: number }> = [];
    const pureUnmatched: string[] = [];
    const mappedIds = new Set<string>();

    for (const rawName of parsedAttendeeNames) {
      // 1. Check if name is manually mapped
      const mappedId = nameMappings[rawName];
      if (mappedId) {
        let foundPlayer = allAvailablePlayers.find(p => p.id === mappedId);
        
        // If not found in combined list, let's look if it was a quick name match in database
        if (!foundPlayer && mappedId.startsWith('GUEST_')) {
          foundPlayer = customGuests.find(g => g.id === mappedId);
        }

        if (foundPlayer) {
          if (!mappedIds.has(foundPlayer.id)) {
            matched.push(foundPlayer);
            mappedIds.add(foundPlayer.id);
          }
          continue;
        }
      }

      // 2. Perform detailed matching
      const matchDetails = getMatchDetails(rawName, allAvailablePlayers);
      if (matchDetails.player) {
        if (matchDetails.confidence === 'high') {
          if (!mappedIds.has(matchDetails.player.id)) {
            matched.push(matchDetails.player);
            mappedIds.add(matchDetails.player.id);
          }
        } else {
          uncertain.push({
            rawName,
            player: matchDetails.player,
            score: matchDetails.score
          });
          unmatched.push(rawName);
        }
      } else {
        pureUnmatched.push(rawName);
        unmatched.push(rawName);
      }
    }

    return { matched, unmatched, uncertain, pureUnmatched };
  }, [parsedAttendeeNames, nameMappings, allAvailablePlayers, customGuests]);

  // All participating players (for team generation input)
  const participatingPlayers = useMemo(() => {
    return resolvedAttendeesResult.matched;
  }, [resolvedAttendeesResult]);

  // Auto-suggest perfect configurations
  const suggestions = useMemo(() => {
    return getTeamSuggestions(participatingPlayers.length);
  }, [participatingPlayers]);

  // Set initial suggest teams
  useEffect(() => {
    if (suggestions.length > 0) {
      // Find one that is close to the currently selected or default
      const optionExists = suggestions.some(s => s.numTeams === selectedNumTeams);
      if (!optionExists) {
        // Fallback to highest team count suggestion that seems elegant
        // E.g. find 3 teams or best fitting
        const defaultSuggest = suggestions.find(s => s.numTeams === 3) || suggestions[0];
        if (defaultSuggest) {
          setSelectedNumTeams(defaultSuggest.numTeams);
        }
      }
    }
  }, [participatingPlayers.length, suggestions]);

  // Dynamic search for manual database view
  const filteredDbPlayers = useMemo(() => {
    if (!dbSearch) return databasePlayers;
    const s = dbSearch.toLowerCase();
    return databasePlayers.filter(p => 
      p.fullName.toLowerCase().includes(s) || 
      p.bestPosition.toLowerCase().includes(s) ||
      (p.positiveAttribute && p.positiveAttribute.toLowerCase().includes(s))
    );
  }, [databasePlayers, dbSearch]);

  // Trigger Team Generation
  const handleGenerateTeams = () => {
    if (participatingPlayers.length === 0) return;
    const teams = generateBalancedTeams(participatingPlayers, selectedNumTeams);
    setGeneratedTeams(teams);
  };

  // Generate automatically if participating players count or selectedNumTeams changes
  useEffect(() => {
    if (participatingPlayers.length > 0) {
      handleGenerateTeams();
    } else {
      setGeneratedTeams([]);
    }
  }, [participatingPlayers, selectedNumTeams]);

  // Copy results format to clipboard
  const handleCopyToClipboard = () => {
    if (generatedTeams.length === 0) return;

    let text = `⚽ Balanced Team Selection ⚽\n`;
    text += `Date: ${new Date().toLocaleDateString('en-GB')}\n`;
    text += `Total Players: ${participatingPlayers.length} | Teams: ${generatedTeams.length}\n\n`;

    generatedTeams.forEach(team => {
      text += `--- ${team.name.toUpperCase()} (Avg skill: ${team.metrics.avgSkill}) ---\n`;
      team.players.forEach((p, index) => {
        const role = getPlayerRole(p);
        text += `${index + 1}. ${p.fullName} [${role}] (Rating: ${p.bestRating})\n`;
      });
      text += `Stats: GK: ${team.metrics.gkCount} | DEF: ${team.metrics.defCount} | MID: ${team.metrics.midCount} | ATT: ${team.metrics.attCount}\n\n`;
    });

    navigator.clipboard.writeText(text).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  // --- Map an Unmatched Raw Name to a Database Player or Guest Template ---
  const handleMapToDatabasePlayer = (rawName: string, playerId: string) => {
    setNameMappings(prev => ({
      ...prev,
      [rawName]: playerId
    }));
  };

  // Reset mappings and guests
  const handleResetSetup = () => {
    showCustomConfirm(
      'Reset Configurations',
      'Are you sure you want to clear custom name mappings and guests?',
      () => {
        setNameMappings({});
        setCustomGuests([]);
        setRawAttendeesText(DEMO_ATTENDEES_RAW);
      }
    );
  };

  // Create Custom Guest for Unresolved Names inline
  const handleCreateGuestForUnmatched = (rawName: string, role: PlayerRole, rating: number) => {
    const guestId = `GUEST_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    
    // Create guest ratings based on role
    const guest: Player = {
      id: guestId,
      surname: 'Guest',
      firstName: rawName,
      fullName: `${rawName} (Guest)`,
      bestRating: rating,
      bestPosition: role === 'GK' ? 'Goalkeeper' : role === 'DEF' ? 'Centre Back' : role === 'MID' ? 'Midfielder' : 'Striker',
      stamina: rating,
      positiveAttribute: 'Quick guest addition',
      isCustomGuest: true
    };

    // Fill in positional rating matching role
    if (role === 'GK') guest.goalkeeper = rating;
    else if (role === 'DEF') guest.centreBack = rating;
    else if (role === 'MID') guest.midfielder = rating;
    else if (role === 'ATT') guest.striker = rating;

    // Add to guests state
    setCustomGuests(prev => [...prev, guest]);

    // Map this raw name to the new guest ID instantly!
    setNameMappings(prev => ({
      ...prev,
      [rawName]: guestId
    }));
  };

  // Delete a single custom guest profile and clear associated mappings
  const handleDeleteSingleGuest = (guestId: string) => {
    const guestToDelete = customGuests.find(g => g.id === guestId);
    if (!guestToDelete) return;

    showCustomConfirm(
      'Remove Temporary Guest',
      `Are you sure you want to completely remove the temporary guest profile for "${guestToDelete.firstName}"?`,
      () => {
        setCustomGuests(prev => prev.filter(g => g.id !== guestId));
        setNameMappings(prev => {
          const updated = { ...prev };
          Object.keys(updated).forEach(key => {
            if (updated[key] === guestId) {
              delete updated[key];
            }
          });
          return updated;
        });
      }
    );
  };

  // Add an unmatched player permanently to the source CSV ratings database
  const handleAddUnmatchedToSource = (rawName: string) => {
    try {
      const parts = rawName.trim().split(/\s+/);
      let firstName = '';
      let surname = '';
      if (parts.length === 1) {
        firstName = parts[0];
        surname = '.';
      } else {
        surname = parts[parts.length - 1];
        firstName = parts.slice(0, parts.length - 1).join(' ');
      }

      // Escape fields if commas or quotes exist
      const escapeCsvField = (str: string) => {
        if (str.includes(',') || str.includes('"')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const escapedSurname = escapeCsvField(surname);
      const escapedFirst = escapeCsvField(firstName);

      // Create standard new CSV record with 75 for midfielder, and 70 for other fields (GK, RB, LB, CB, DMF, Mid, AM, Winger, Striker, Stamina)
      const newLine = `${escapedSurname},${escapedFirst},70,70,70,70,70,75,70,70,70,70,,`;

      setCsvContent(prev => {
        const trimmed = prev.trim();
        return trimmed + '\n' + newLine;
      });

      showCustomAlert('Database Profile Created', `"${rawName}" has been successfully added to the HCOBF Master Database with a 75 Midfielder rating (70 baseline elsewhere)!`);
    } catch (err: any) {
      showCustomAlert('Import Failure', `Error adding player to source matrix: ${err.message}`);
    }
  };

  // Add all unmatched players at once to the source CSV ratings database with 70 ratings
  const handleAddAllUnmatchedToSource = (unmatchedList: string[], silent: boolean = false) => {
    try {
      if (unmatchedList.length === 0) return;
      
      let isChanged = false;
      let newLines = '';
      
      unmatchedList.forEach(rawName => {
        const parts = rawName.trim().split(/\s+/);
        let firstName = '';
        let surname = '';
        if (parts.length === 1) {
          firstName = parts[0];
          surname = '.';
        } else {
          surname = parts[parts.length - 1];
          firstName = parts.slice(0, parts.length - 1).join(' ');
        }

        // Ignore temporary empty inputs or short names
        if (firstName.length < 2) return;

        const escapeCsvField = (str: string) => {
          if (str.includes(',') || str.includes('"')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        };

        const escapedSurname = escapeCsvField(surname);
        const escapedFirst = escapeCsvField(firstName);

        const formattedCheck = `${surname},${firstName}`.toLowerCase();
        const reverseCheck = `${firstName},${surname}`.toLowerCase();

        if (
          csvContent.toLowerCase().includes(formattedCheck) ||
          csvContent.toLowerCase().includes(reverseCheck) ||
          csvContent.toLowerCase().includes(rawName.toLowerCase())
        ) {
          return;
        }

        newLines += `\n${escapedSurname},${escapedFirst},70,70,70,70,70,75,70,70,70,70,,`;
        isChanged = true;
      });

      if (isChanged && newLines) {
        setCsvContent(prev => {
          const trimmed = prev.trim();
          return trimmed + newLines;
        });
        if (!silent) {
          showCustomAlert('Batch Profiles Registered', `Successfully added ${unmatchedList.length} player(s) to the HCOBF Master Database with a 75 Midfielder rating (70 baseline elsewhere)!`);
        }
      }
    } catch (err: any) {
      if (!silent) {
        showCustomAlert('Batch Import Error', `Error adding players: ${err.message}`);
      }
    }
  };

  // Heal legacy mappings
  useEffect(() => {
    // Clear legacy 'Other Child' mapping that replaced it with 'Child_Eze_Small'
    setNameMappings(prev => {
      const copy = { ...prev };
      let hadLegacy = false;
      if (copy['Other Child']) {
        delete copy['Other Child'];
        hadLegacy = true;
      }
      if (hadLegacy) {
        return copy;
      }
      return prev;
    });
  }, []);

  // Save CSV Content from manual text editor
  const handleSaveCsvEditor = () => {
    try {
      // test parse
      const testParse = parsePlayersCsv(csvEditValue);
      if (testParse.length === 0) {
        showCustomAlert('Parsing Error', 'Error: CSV parsing yielded zero players. Please verify the header format.');
        return;
      }
      setCsvContent(csvEditValue);
      setIsCsvModified(false);
      showCustomAlert('Database Preserved', 'Players Matrix successfully updated!');
    } catch (e: any) {
      showCustomAlert('Invalid Schema', `Invalid format: ${e.message}`);
    }
  };

  // Restore Default CSV Database
  const handleRestoreDefaultCsv = () => {
    showCustomConfirm(
      'Restore Default Catalog',
      'Are you sure you want to overwrite all changes and restore the default player rating matrix?',
      () => {
        setCsvContent(DEFAULT_PLAYERS_CSV);
        setCsvEditValue(DEFAULT_PLAYERS_CSV);
        setIsCsvModified(false);
      }
    );
  };

  // Download CURRENT CSV backup file
  const handleDownloadCsv = () => {
    try {
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `squad_builder_ratings_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Error downloading CSV matrix:', err);
      showCustomAlert('Download Failed', 'Failed to generate CSV download.');
    }
  };

  // Parse file and stream to matrix text state
  const handleCsvFileUpload = (file: File) => {
    setUploadError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) {
        setUploadError('Selected file appears to be empty.');
        return;
      }
      try {
        const testParse = parsePlayersCsv(text);
        if (testParse.length === 0) {
          setUploadError('Zero valid players detected. Check column names and format.');
          return;
        }
        setCsvContent(text);
        setCsvEditValue(text);
        setIsCsvModified(false);
        showCustomAlert('CSV Successfully Imported', `Success! The master ratings matrix has been fully updated and replaced with ${testParse.length} players from your uploaded CSV file.`);
      } catch (err: any) {
        setUploadError(`Formatting error: ${err.message}`);
      }
    };
    reader.onerror = () => {
      setUploadError('Failed to read the file.');
    };
    reader.readAsText(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleCsvFileUpload(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleCsvFileUpload(files[0]);
    }
  };

  // Move or swap players manually in current state
  const handleMovePlayer = (playerId: string, originTeamId: number, targetTeamId: number) => {
    setGeneratedTeams(prev => {
      const updated = prev.map(t => {
        if (t.id === originTeamId) {
          return {
            ...t,
            players: t.players.filter(p => p.id !== playerId)
          };
        }
        if (t.id === targetTeamId) {
          const movingPlayer = participatingPlayers.find(p => p.id === playerId);
          if (movingPlayer) {
            return {
              ...t,
              players: [...t.players, movingPlayer]
            };
          }
        }
        return t;
      });

      // Recalculate metrics for any affected teams
      return updated.map(t => ({
        ...t,
        players: t.players.sort((a, b) => b.bestRating - a.bestRating),
        metrics: calculateTeamMetrics(t.players)
      }));
    });
  };

  const handleInitiateSwap = (teamId: number, playerId: string) => {
    if (activeSwapPlayerId === null) {
      setActiveSwapPlayerId({ teamId, playerId });
    } else {
      // Perform swap!
      const swap1 = activeSwapPlayerId;
      const swap2 = { teamId, playerId };

      if (swap1.teamId === swap2.teamId) {
        // Swap selection reset, same team
        setActiveSwapPlayerId(null);
        return;
      }

      setGeneratedTeams(prev => {
        const team1 = prev.find(t => t.id === swap1.teamId);
        const team2 = prev.find(t => t.id === swap2.teamId);

        if (!team1 || !team2) return prev;

        const p1 = team1.players.find(p => p.id === swap1.playerId);
        const p2 = team2.players.find(p => p.id === swap2.playerId);

        if (!p1 || !p2) return prev;

        const updated = prev.map(t => {
          if (t.id === swap1.teamId) {
            return {
              ...t,
              players: t.players.map(p => p.id === swap1.playerId ? p2 : p)
            };
          }
          if (t.id === swap2.teamId) {
            return {
              ...t,
              players: t.players.map(p => p.id === swap2.playerId ? p1 : p)
            };
          }
          return t;
        });

        return updated.map(t => ({
          ...t,
          players: t.players.sort((a, b) => b.bestRating - a.bestRating),
          metrics: calculateTeamMetrics(t.players)
        }));
      });

      setActiveSwapPlayerId(null);
    }
  };

  // --- Lock Screen Overlay if no user authorized ---
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 selection:bg-rose-800 relative overflow-hidden">
        {/* Decorative soccer grid/velvet gradients */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#400c0c] via-slate-950 to-slate-950 opacity-90 pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(#ffffff04_1px,transparent_1px)] [background-size:20px_20px] pointer-events-none" />
        
        {/* Gold blur accent */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] rounded-full bg-amber-500/5 blur-[120px] pointer-events-none" />

        <div className="z-10 w-full max-w-md flex flex-col items-center gap-6 animate-fade-in">
          <ClubLogo size={135} showText={false} className="drop-shadow-2xl" />
          
          <div className="text-center space-y-1">
            <h2 className="text-xl font-black tracking-tight text-white font-serif uppercase">
              Harrow College Old Boys FC
            </h2>
            <p className="text-xs text-amber-400 font-mono tracking-widest uppercase font-extrabold pb-1">
              Squad Builder Secure Access
            </p>
          </div>

          <div className="bg-slate-900/95 border border-amber-500/20 shadow-2xl rounded-2xl p-6 w-full backdrop-blur-sm">
            <h3 className="text-xs font-bold text-slate-100 flex items-center gap-2 border-b border-slate-800 pb-3 mb-4 uppercase tracking-wider">
              <Lock className="h-4 w-4 text-amber-500" />
              Authorize Active Session
            </h3>

            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              {/* Dropdown Select User list */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <User className="h-3 w-3 text-amber-500/70" />
                  Select Registered Profile
                </label>
                <select
                  value={loginSelectedUserId}
                  onChange={(e) => {
                    setLoginSelectedUserId(e.target.value);
                    setLoginError(null);
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
                >
                  {iamUsers.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.name} ({user.role})
                    </option>
                  ))}
                </select>
              </div>

              {/* Passcode Entry */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Key className="h-3 w-3 text-amber-500/70" />
                  Security Passcode PIN
                </label>
                <input
                  type="password"
                  pattern="\d*"
                  maxLength={6}
                  placeholder="••••••"
                  value={loginPin}
                  onChange={(e) => {
                    setLoginPin(e.target.value.replace(/\D/g, ''));
                    setLoginError(null);
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-slate-105 text-center tracking-widest text-lg font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              {/* In-UI Touch-Friendly Keypad */}
              <div className="grid grid-cols-3 gap-1.5 mt-1">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => {
                      setLoginPin(prev => prev + num);
                      setLoginError(null);
                    }}
                    className="bg-slate-950 hover:bg-slate-800 border border-slate-800/60 rounded-lg py-2.5 text-slate-100 font-mono font-bold text-xs transition cursor-pointer active:scale-95 flex items-center justify-center shadow-inner"
                  >
                    {num}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setLoginPin('');
                    setLoginError(null);
                  }}
                  className="bg-slate-950 hover:bg-slate-900 border border-slate-800/30 rounded-lg py-2.5 text-rose-450 font-bold text-[9px] uppercase transition cursor-pointer active:scale-95 flex items-center justify-center font-sans"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoginPin(prev => prev + '0');
                    setLoginError(null);
                  }}
                  className="bg-slate-950 hover:bg-slate-800 border border-slate-800/60 rounded-lg py-2.5 text-slate-100 font-mono font-bold text-xs transition cursor-pointer active:scale-95 flex items-center justify-center shadow-inner"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoginPin(prev => prev.slice(0, -1));
                    setLoginError(null);
                  }}
                  className="bg-slate-950 hover:bg-slate-900 border border-slate-850/40 rounded-lg py-2.5 text-slate-400 font-bold text-[9px] uppercase transition cursor-pointer active:scale-95 flex items-center justify-center font-sans"
                >
                  Delete
                </button>
              </div>

              {loginError && (
                <div className="bg-rose-950/40 border border-rose-900/40 text-rose-305 px-3.5 py-2 rounded-lg text-[10px] font-semibold flex items-start gap-1.5 leading-normal mt-1 animate-pulse">
                  <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-rose-500 mt-0.5" />
                  <span>{loginError}</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-amber-500 hover:bg-amber-600 active:scale-[0.99] text-slate-950 font-black tracking-tight text-xs py-2.5 mt-2 rounded-lg transition-all cursor-pointer shadow flex items-center justify-center gap-1.5"
              >
                <Unlock className="h-3.5 w-3.5" />
                Authorize & Unlock
              </button>
            </form>

            {/* Login Notice Removed */}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-rose-800 selection:text-white flex flex-col">
      {/* Top Header */}
      <header className="py-2.5 md:h-16 flex items-center justify-between px-3 md:px-6 bg-slate-900 text-white shrink-0 border-b border-amber-500/20 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto w-full flex flex-col md:flex-row md:items-center justify-between gap-2.5 md:gap-4">
          
          <div className="flex items-center justify-between w-full md:w-auto">
            <div className="flex items-center gap-2">
              {/* HCOBF Club Icon Logo */}
              <ClubLogo size={36} showText={false} />
              <div>
                <h1 className="text-sm md:text-lg font-black tracking-tight text-white flex items-center gap-1 font-serif">
                  <span className="hidden sm:inline">Harrow Old Boys FC</span>
                  <span className="sm:hidden">Harrow OB FC</span>
                  <span className="text-[8px] md:text-[9px] font-mono font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1 md:px-1.5 py-0.5 rounded ml-0.5 md:ml-1">Squad</span>
                </h1>
              </div>
            </div>
            {/* Show Logout on Right in Mobile header directly to save horizontal space */}
            <div className="flex items-center md:hidden gap-2">
              <span className="text-[9px] font-mono bg-amber-400/10 border border-amber-500/15 px-1.5 py-0.5 rounded text-amber-400 font-bold max-w-[80px] truncate">
                {currentUser?.name}
              </span>
              <button
                onClick={handleLogout}
                className="p-1.5 bg-slate-800 hover:bg-rose-955/40 hover:text-rose-455 border border-slate-700/60 rounded-md text-xs font-bold transition flex items-center gap-1 cursor-pointer text-slate-350"
                title="Logout"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between md:justify-end gap-3 w-full md:w-auto overflow-x-auto scrollbar-none py-0.5">
            <div className="flex items-center gap-0.5 md:gap-1 p-0.5 md:p-1 rounded-lg bg-slate-800 w-full md:w-auto justify-between md:justify-start">
              <button
                onClick={() => setActiveTab('picker')}
                className={`flex-1 md:flex-none px-2.5 md:px-4 py-1.5 rounded-md text-[10.5px] md:text-xs font-black transition-all flex items-center justify-center gap-1 md:gap-1.5 cursor-pointer whitespace-nowrap ${
                  activeTab === 'picker'
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700'
                }`}
              >
                <Shuffle className="h-3.5 w-3.5 shrink-0" />
                <span>Dashboard</span>
              </button>
              <button
                onClick={() => setActiveTab('database')}
                className={`flex-1 md:flex-none px-2.5 md:px-4 py-1.5 rounded-md text-[10.5px] md:text-xs font-black transition-all flex items-center justify-center gap-1 md:gap-1.5 cursor-pointer whitespace-nowrap ${
                  activeTab === 'database'
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700'
                }`}
              >
                <FileText className="h-3.5 w-3.5 shrink-0" />
                <span>Matrix ({databasePlayers.length})</span>
              </button>
              <button
                onClick={() => setActiveTab('security')}
                className={`flex-1 md:flex-none px-2.5 md:px-4 py-1.5 rounded-md text-[10.5px] md:text-xs font-black transition-all flex items-center justify-center gap-1 md:gap-1.5 cursor-pointer whitespace-nowrap ${
                  activeTab === 'security'
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700'
                }`}
              >
                <Shield className="h-3.5 w-3.5 shrink-0" />
                <span>Access</span>
              </button>
            </div>

            {/* Desktop-only session info */}
            <div className="hidden md:flex items-center gap-2.5">
              <div className="flex flex-col items-end">
                <span className="text-[9px] font-mono tracking-tight text-amber-400 font-bold bg-amber-400/10 border border-amber-500/15 px-1.5 py-0.5 rounded leading-none">
                  {currentUser?.role === 'Master Admin' ? '👑 Master Admin' : currentUser?.role === 'Admin' ? '🛡️ Admin' : '👤 User'}
                </span>
                <span className="text-[11px] text-slate-300 font-bold max-w-[120px] truncate mt-0.5">
                  {currentUser?.name}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 bg-slate-800 hover:bg-rose-950/40 hover:text-rose-450 border border-slate-700/60 hover:border-rose-900/30 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm text-slate-300"
                title="Logout from active session"
              >
                <LogOut className="h-3.5 w-3.5 text-slate-400 hover:text-rose-400" />
                <span className="text-[11px]">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Layout */}
      <main className="max-w-7xl mx-auto w-full px-3 md:px-6 py-4 md:py-8 flex flex-col gap-6 flex-1">

        {activeTab === 'picker' ? (
          <>
            {/* HCOBF Showcase Hero Header */}
            <ClubBanner />
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 md:gap-8 items-start">
            
            {/* Left Hand: Paste Lineup & Resolve Guests Panel */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              
              {/* Card 1: Attendance Paste Area */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col">
                <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-3">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-blue-500" />
                    Pasted Attending Players
                  </h3>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setRawAttendeesText('')}
                      className="text-[10px] text-rose-600 hover:text-rose-700 font-bold bg-rose-50 hover:bg-rose-100/70 border border-rose-100 px-2 py-1 rounded transition cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                  Paste attendance list or text from a webpage message. Each line will map against the sport skill index directory.
                </p>

                <textarea
                  className="w-full h-52 bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono resize-y"
                  placeholder="Paste weekly message here... Example:&#10;Cristiano Miries&#10;Jayson Mehra&#10;Other Child..."
                  value={rawAttendeesText}
                  onChange={(e) => setRawAttendeesText(e.target.value)}
                />

                {/* Highly visible Missing Players Highlighter Widget */}
                {resolvedAttendeesResult.unmatched.length > 0 && (
                  <div className="mt-3.5 p-3.5 bg-rose-50 border-2 border-rose-300 rounded-xl">
                    <div className="flex items-center gap-1.5 text-xs font-black text-rose-800 mb-1">
                      <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 animate-pulse" />
                      {resolvedAttendeesResult.unmatched.length} PLAYER(S) MISSING FROM MATRIX!
                    </div>
                    <p className="text-[11px] text-rose-700/90 leading-relaxed mb-2.5">
                      The listed players are not registered in the HCOBF ratings database. They are currently <strong>excluded from the teams</strong>.
                    </p>
                    <div className="flex flex-col gap-1.5 max-h-[160px] overflow-y-auto pr-1">
                      {resolvedAttendeesResult.unmatched.map((name) => (
                        <div key={name} className="flex items-center justify-between gap-2 p-1.5 bg-white border border-rose-200 rounded-lg shadow-sm hover:border-rose-300 transition">
                          <span className="font-bold text-[11px] text-rose-950 font-mono truncate">
                            ⚠️ {name}
                          </span>
                          <button
                            onClick={() => handleAddUnmatchedToSource(name)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white rounded px-2.5 py-1 text-[10px] font-extrabold transition cursor-pointer flex items-center gap-0.5 shadow-xs"
                            title={`Click to add "${name}" to the master database with 75 Midfielder rating and 70 elsewhere.`}
                          >
                            <Plus className="h-2.5 w-2.5" />
                            Add permanently (Mid 75)
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-4 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100 pt-3">
                  <div className="flex items-center gap-1">
                    <span className="font-bold text-slate-800">{parsedAttendeeNames.length}</span> names detected
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                    <span className="font-bold text-slate-850">{participatingPlayers.length}</span> matched & loaded
                  </div>
                </div>
              </div>

              {/* Card 2: Smart Mapper for Unresolved Players */}
              {resolvedAttendeesResult.unmatched.length > 0 && (
                <div className="bg-amber-50/40 border border-amber-200 rounded-xl p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-3 border-b border-amber-100 pb-3 flex-wrap gap-2">
                    <h3 className="text-xs font-bold text-amber-800 uppercase tracking-widest flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-600" />
                      Unresolved List Entries ({resolvedAttendeesResult.unmatched.length})
                    </h3>
                    
                    <div className="flex items-center gap-2.5">
                      <button
                        onClick={() => handleAddAllUnmatchedToSource(resolvedAttendeesResult.unmatched)}
                        className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-extrabold flex items-center gap-1 shadow-sm transition cursor-pointer"
                        title="Add all remaining unresolved names permanently to the database with a 75 Midfielder rating and 70 elsewhere."
                      >
                        <Plus className="h-3 w-3" />
                        Add All as New (Mid 75)
                      </button>

                      <button
                        onClick={handleResetSetup}
                        title="Clear custom guest templates and reset mapping definitions"
                        className="text-[10px] text-amber-700 hover:text-amber-900 underline font-mono font-medium cursor-pointer"
                      >
                        Reset All Mappings
                      </button>
                    </div>
                  </div>

                  <p className="text-[11px] text-amber-700/90 mb-4 leading-relaxed">
                    Some pasted attendees need attention. Verify suggested fuzzy matches or add missing players to the master ratings directory.
                  </p>

                  <div className="flex flex-col gap-4 max-h-[420px] overflow-y-auto pr-1">
                    {/* SECTION 1: UNCERTAIN MATCHES */}
                    {resolvedAttendeesResult.uncertain.length > 0 && (
                      <div className="flex flex-col gap-3">
                        <div className="text-[10px] font-extrabold text-amber-900/80 uppercase tracking-wider mb-0.5">
                          ⚠️ Uncertain Matches ({resolvedAttendeesResult.uncertain.length}) - Verify Suggested Pairings
                        </div>
                        {resolvedAttendeesResult.uncertain.map(({ rawName, player, score }) => (
                          <div key={rawName} className="bg-white border border-amber-300 rounded-xl p-4 text-xs flex flex-col gap-2.5 shadow-sm">
                            <div className="font-bold text-slate-850 flex items-center justify-between">
                              <span className="text-amber-700 font-mono">"{rawName}"</span>
                              <span className="text-[9px] text-amber-800 bg-amber-100 px-2 py-0.5 rounded font-mono uppercase tracking-wider font-extrabold">Confirm or Change</span>
                            </div>

                            <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-100/80 text-[11px] text-amber-900 leading-relaxed flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
                              <div>
                                <span className="font-medium text-amber-800">Fuzzy Match Suggestion:</span>{' '}
                                <strong className="font-black text-rose-950">{player.fullName}</strong>
                                <span className="text-[10px] text-slate-500 font-mono ml-1.5">(Rating {player.bestRating} - {player.bestPosition})</span>
                              </div>
                              <button
                                onClick={() => handleMapToDatabasePlayer(rawName, player.id)}
                                className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg px-3 py-1 text-[10.5px] font-black transition cursor-pointer self-start sm:self-center flex items-center gap-1 shrink-0 shadow-sm"
                              >
                                <Check className="h-3.5 w-3.5" />
                                Confirm Match
                              </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1 pt-2 border-t border-slate-100">
                              {/* Option A: Link Custom Selection */}
                              <div className="flex flex-col gap-1">
                                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Map to different profile:</label>
                                <select
                                  className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-slate-800 text-[11px] focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  onChange={(e) => handleMapToDatabasePlayer(rawName, e.target.value)}
                                  defaultValue=""
                                >
                                  <option value="" disabled>-- Select Profile --</option>
                                  {databasePlayers
                                    .filter(p => !participatingPlayers.some(active => active.id === p.id))
                                    .map(p => (
                                      <option key={p.id} value={p.id}>
                                        {p.fullName} (Skill: {p.bestRating} - {p.bestPosition})
                                      </option>
                                    ))}
                                </select>
                              </div>

                              {/* Option B: Permanent New database profile */}
                              <div className="flex flex-col gap-1">
                                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Create new active record:</label>
                                <button
                                  type="button"
                                  onClick={() => handleAddUnmatchedToSource(rawName)}
                                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-700 rounded px-2.5 py-1 text-[10.5px] font-black tracking-tight transition cursor-pointer text-center flex items-center justify-center gap-1.5 shadow-xs"
                                >
                                  <Plus className="h-3 w-3" />
                                  Add to matrix (CM 75, baseline 70)
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* SECTION 2: COMPLETELY UNMATCHED / MISSING */}
                    {resolvedAttendeesResult.pureUnmatched.length > 0 && (
                      <div className="flex flex-col gap-3 mt-1">
                        <div className="text-[10px] font-extrabold text-rose-800/90 uppercase tracking-wider mb-0.5">
                          ❌ Highly Missing players ({resolvedAttendeesResult.pureUnmatched.length}) - Action Required
                        </div>
                        {resolvedAttendeesResult.pureUnmatched.map((rawName) => (
                          <div key={rawName} className="bg-white border border-rose-200 rounded-xl p-4 text-xs flex flex-col gap-2.5 shadow-sm">
                            <div className="font-bold text-slate-850 flex items-center justify-between">
                              <span className="text-rose-700 font-mono">"{rawName}"</span>
                              <span className="text-[9px] text-rose-800 bg-rose-100 px-2 py-0.5 rounded font-mono uppercase tracking-wider font-extrabold">Not Registered</span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1 pt-2">
                              {/* Option A: Map to Existing Database player */}
                              <div className="flex flex-col gap-1">
                                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Link to existing profile:</label>
                                <select
                                  className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-slate-800 text-[11px] focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  onChange={(e) => handleMapToDatabasePlayer(rawName, e.target.value)}
                                  defaultValue=""
                                >
                                  <option value="" disabled>-- Select Existing Profile --</option>
                                  {databasePlayers
                                    .filter(p => !participatingPlayers.some(active => active.id === p.id))
                                    .map(p => (
                                      <option key={p.id} value={p.id}>
                                        {p.fullName} (Skill: {p.bestRating} - {p.bestPosition})
                                      </option>
                                    ))}
                                </select>
                              </div>

                              {/* Option B: Standard Guest Options */}
                              <div className="flex flex-col gap-1">
                                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Setup temporary guest:</label>
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => handleCreateGuestForUnmatched(rawName, 'GK', 80)}
                                    className="flex-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[10px] font-bold py-1 rounded transition cursor-pointer"
                                    title="Add guest goalkeeper"
                                  >
                                    GK (80)
                                  </button>
                                  <button
                                    onClick={() => handleCreateGuestForUnmatched(rawName, 'MID', 75)}
                                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-[10px] font-bold py-1 rounded transition cursor-pointer"
                                    title="Add guest midfielder"
                                  >
                                    Mid (75)
                                  </button>
                                  <button
                                    onClick={() => handleCreateGuestForUnmatched(rawName, 'ATT', 85)}
                                    className="flex-1 bg-blue-50 hover:bg-blue-105 text-blue-700 border border-blue-200 text-[10px] font-bold py-1 rounded transition cursor-pointer"
                                    title="Add guest striker"
                                  >
                                    Str (85)
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Option C: Permanent Addition with CM / 75 attributes */}
                            <div className="mt-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleAddUnmatchedToSource(rawName)}
                                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-3 py-2 text-[10.5px] font-black transition cursor-pointer hover:shadow-sm flex items-center justify-center gap-1.5 shadow-xs"
                                title={`Click to add "${rawName}" permanently to the ratings matrix with a 75 Midfielder rating and 70 elsewhere.`}
                              >
                                <Plus className="h-3.5 w-3.5" />
                                Add permanently to Master Database (75 Midfielder, 70 baseline)
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Card 2.5: Active Guest Profiles Manager */}
              {customGuests.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-2">
                  <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-3">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-amber-500" />
                      Temporary Guest Profiles ({customGuests.length})
                    </h3>
                    <button
                      onClick={handleResetSetup}
                      title="Clear all guest profiles and mappings"
                      className="text-[10px] text-rose-600 hover:text-rose-700 font-bold bg-rose-50 hover:bg-rose-100/70 border border-rose-100 px-2.5 py-1 rounded transition cursor-pointer"
                    >
                      Clear All
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 mb-4 leading-relaxed">
                    These are temporary guests added for today's match. Removing them here will also unmap their names.
                  </p>
                  <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
                    {customGuests.map(g => {
                      const role = getPlayerRole(g);
                      let roleBadgeColor = 'bg-blue-50 text-blue-700 border-blue-200';
                      if (role === 'GK') roleBadgeColor = 'bg-rose-50 text-rose-700 border-rose-200';
                      if (role === 'DEF') roleBadgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                      if (role === 'ATT') roleBadgeColor = 'bg-amber-50 text-amber-700 border-amber-200';

                      return (
                        <div
                          key={g.id}
                          className="flex items-center justify-between gap-3 p-2 bg-slate-50 border border-slate-200 rounded-lg hover:border-slate-350 transition duration-150"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="font-semibold text-slate-800 truncate">{g.fullName}</span>
                            <span className={`text-[9px] px-1.5 rounded font-bold border ${roleBadgeColor} shrink-0`}>{role}</span>
                            <span className="text-blue-600 font-mono text-[10px] font-bold shrink-0">★ {g.bestRating}</span>
                          </div>
                          <button
                            onClick={() => handleDeleteSingleGuest(g.id)}
                            className="p-1 hover:bg-rose-100 border border-transparent hover:border-rose-200 rounded text-rose-600 hover:text-rose-700 transition cursor-pointer shrink-0"
                            title={`Remove temporary guest profile for ${g.fullName}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Card 3: Live Player Roster Details representing what fits into the dynamic setup */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
                  <ListFilter className="h-4 w-4 text-emerald-500" />
                  Active Squad Members ({participatingPlayers.length})
                </h3>
                
                {participatingPlayers.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No squads loaded yet. Fill original weekly pasting block.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto pr-1">
                    {participatingPlayers.map(p => {
                      const role = getPlayerRole(p);
                      let roleBadgeColor = 'bg-blue-50 text-blue-700 border-blue-200';
                      if (role === 'GK') roleBadgeColor = 'bg-rose-50 text-rose-700 border-rose-200';
                      if (role === 'DEF') roleBadgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                      if (role === 'ATT') roleBadgeColor = 'bg-amber-50 text-amber-700 border-amber-200';

                      return (
                        <div
                          key={p.id}
                          className="flex items-center gap-2 px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg hover:border-slate-350 transition duration-150"
                        >
                          <span className="font-semibold text-slate-800">{p.fullName}</span>
                          <span className={`text-[9px] px-1.5 rounded font-bold border ${roleBadgeColor}`}>{role}</span>
                          <span className="text-blue-600 font-mono text-[10px] font-bold">{p.bestRating}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>

            {/* Right Hand: Balancing Options & Generated Teams */}
            <div className="lg:col-span-7 flex flex-col gap-6">

              {/* High prominence Warning banner informing user of Excluded players */}
              {resolvedAttendeesResult.unmatched.length > 0 && (
                <div className="bg-[#881c1c] text-white rounded-xl p-5 shadow-lg flex items-start gap-3.5 border border-red-500/30 bg-gradient-to-br from-[#801818] to-[#4c0909]">
                  <AlertCircle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5 animate-pulse" />
                  <div className="flex-1 text-xs">
                    <span className="font-extrabold text-amber-300 uppercase tracking-widest block mb-1 font-mono text-[9px]">
                      ⚠️ SQUAD INCOMPLETE
                    </span>
                    <span className="font-black text-white text-sm block mb-1">
                      {resolvedAttendeesResult.unmatched.length} player(s) are missing from the Matrix!
                    </span>
                    <p className="text-red-105/90 leading-relaxed text-[11.5px] font-medium">
                      One or more pasted attendees (including <strong className="font-mono text-amber-300">"{resolvedAttendeesResult.unmatched[0]}"</strong>) do not exist in the active ratings matrix. They are <strong>excluded from the generated teams</strong>.
                    </p>
                    <div className="mt-3 pt-2.5 border-t border-red-300/20 flex flex-wrap gap-2">
                      <span className="text-[10px] text-amber-300 font-extrabold uppercase tracking-wider self-center">Resolve fast:</span>
                      <button
                        onClick={() => {
                          const el = document.getElementById('unmatched-mapper-section');
                          if (el) el.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="px-2.5 py-1 bg-white/10 hover:bg-white/20 border border-white/20 rounded text-[10px] text-white font-extrabold transition cursor-pointer"
                      >
                        ← View Missing Profiles inside Left Column
                      </button>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Card 1: Configuration Controls */}
              <div id="unmatched-mapper-section" className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <Sliders className="h-4 w-4 text-blue-500" />
                      Dynamic Team Generator
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Distributes ratings symmetrically while enforcing optimal Goalkeeper placement.
                    </p>
                  </div>
                  
                  {/* Team suggestions pill */}
                  {participatingPlayers.length > 0 && (
                    <div className="bg-blue-50 border border-blue-100 rounded-lg px-2.5 py-1 text-xs text-blue-700 flex items-center gap-1.5 font-medium">
                      <Sparkles className="h-3.5 w-3.5" />
                      Balancing Engine Active
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-100 pt-4">
                  {/* Select Number of Teams */}
                  <div className="flex flex-col gap-2">
                    <label className="text-xs text-slate-500 font-bold uppercase tracking-wider">Number of Teams:</label>
                    <div className="flex gap-2">
                      {[2, 3, 4, 5].map((num) => {
                        const isSuggested = suggestions.some(s => s.numTeams === num);
                        return (
                          <button
                            key={num}
                            onClick={() => setSelectedNumTeams(num)}
                            className={`flex-1 py-3 text-xs rounded-lg font-bold border transition duration-150 cursor-pointer ${
                              selectedNumTeams === num
                                ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-100'
                                : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-slate-800'
                            }`}
                          >
                            {num} Teams
                            {isSuggested && (
                              <span className={`block text-[8px] font-mono uppercase tracking-widest ${selectedNumTeams === num ? 'text-blue-200' : 'text-blue-500'}`}>Suggested</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Suggestions List dropdown */}
                  <div className="flex flex-col gap-2">
                    <label className="text-xs text-slate-500 font-bold uppercase tracking-wider">Lineup Suggestions:</label>
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-650 h-[72px] overflow-y-auto">
                      {suggestions.length > 0 ? (
                        <div className="space-y-1">
                          {suggestions.map((s, index) => (
                            <div key={index} className="flex items-center gap-1.5 text-[11px]">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                              <span className={s.numTeams === selectedNumTeams ? 'font-bold text-blue-600' : ''}>
                                {s.label}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-slate-400 italic">Analysis will load once attendees find directory ratings.</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Main Generation button */}
                <div className="mt-5 flex gap-2">
                  <button
                    onClick={handleGenerateTeams}
                    disabled={participatingPlayers.length === 0}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm h-11 px-6 rounded-lg flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-blue-200"
                  >
                    <Shuffle className="h-4 w-4" />
                    REGENERATE TEAMS
                  </button>

                  {generatedTeams.length > 0 && (
                    <button
                      onClick={handleCopyToClipboard}
                      className="px-5 h-11 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 flex items-center gap-2 transition cursor-pointer border-solid shadow"
                    >
                      <Copy className="h-4 w-4 text-blue-600" />
                      {isCopied ? 'Copied!' : 'Copy Teams'}
                    </button>
                  )}
                </div>
              </div>

              {/* Active swap notification banner */}
              {activeSwapPlayerId && (
                <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg flex items-center justify-between text-xs font-semibold animate-pulse shadow-sm">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-blue-500 shrink-0" />
                    <span>
                      Swap mode: select any opposite player/slot to perform instant player swap.
                    </span>
                  </div>
                  <button
                    onClick={() => setActiveSwapPlayerId(null)}
                    className="text-xs font-bold underline text-blue-600 hover:text-blue-800"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {/* Generated balanced team cards list */}
              {generatedTeams.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {generatedTeams.map((team, tIdx) => {
                    const colors = [
                      { bg: 'border-l-sky-500', headerBg: 'bg-sky-50/50 text-sky-800 border-b border-sky-100', barHex: 'bg-sky-500', badge: 'bg-sky-100 text-sky-800 border border-sky-200' },
                      { bg: 'border-l-rose-500', headerBg: 'bg-rose-50/50 text-rose-800 border-b border-rose-105', barHex: 'bg-rose-500', badge: 'bg-rose-100 text-rose-800 border border-rose-200' },
                      { bg: 'border-l-amber-500', headerBg: 'bg-amber-50/50 text-amber-800 border-b border-amber-100', barHex: 'bg-amber-500', badge: 'bg-amber-100 text-amber-800 border border-amber-200' },
                      { bg: 'border-l-emerald-500', headerBg: 'bg-emerald-50/50 text-emerald-810 border-b border-emerald-100', barHex: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-800 border border-emerald-200' },
                      { bg: 'border-l-indigo-505', headerBg: 'bg-indigo-50/50 text-indigo-805 border-b border-indigo-100', barHex: 'bg-indigo-505', badge: 'bg-indigo-100 text-indigo-805 border border-indigo-200' },
                    ];

                    const style = colors[tIdx % colors.length];

                    return (
                      <div
                        key={team.id}
                        className={`bg-white border border-slate-200 border-l-4 ${style.bg} rounded-xl shadow-sm overflow-hidden flex flex-col`}
                      >
                        {/* Team Title header */}
                        <div className={`px-4 py-3 flex items-center justify-between ${style.headerBg}`}>
                          <div>
                            <span className="font-bold text-sm tracking-wide text-slate-800 block">
                              {team.name}
                            </span>
                            <span className="text-[10px] text-slate-500 font-medium">
                              {team.players.length} Squad Members
                            </span>
                          </div>

                          <div className="text-right">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${style.badge}`}>
                              Rating: {team.metrics.avgSkill}
                            </span>
                          </div>
                        </div>

                        {/* Players list inside team */}
                        <div className="p-3 flex-1 flex flex-col gap-1.5 max-h-[350px] overflow-y-auto bg-white">
                          {team.players.map(p => {
                            const isSelectedForSwap = activeSwapPlayerId?.playerId === p.id && activeSwapPlayerId?.teamId === team.id;
                            const role = getPlayerRole(p);
                            
                            let roleColor = 'text-blue-700 bg-blue-50 border-blue-200';
                            if (role === 'GK') roleColor = 'text-rose-700 bg-rose-50 border-rose-200';
                            if (role === 'DEF') roleColor = 'text-emerald-700 bg-emerald-50 border-emerald-200';
                            if (role === 'ATT') roleColor = 'text-amber-700 bg-amber-50 border-amber-200';

                            return (
                              <div
                                key={p.id}
                                className={`group/item flex items-center justify-between p-2.5 rounded-lg text-xs transition border ${
                                  isSelectedForSwap
                                    ? 'bg-blue-50 border-blue-400 text-blue-900 shadow-sm'
                                    : 'bg-white border-slate-100 hover:border-slate-300 hover:bg-slate-50/50 shadow-sm'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <span className={`text-[9px] font-bold px-1.5 rounded border ${roleColor}`}>
                                    {role}
                                  </span>
                                  <div>
                                    <span className="font-semibold text-slate-800 block">
                                      {p.fullName}
                                    </span>
                                    <span className="text-[9px] text-slate-400 font-medium tracking-tight block">
                                      {p.bestPosition} • Stamina: {p.stamina}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="text-blue-600 font-mono text-[11px] font-bold bg-blue-50 px-2 py-0.5 rounded border border-blue-105">
                                    {p.bestRating}
                                  </span>
                                  
                                  {/* Fast Interactive Controls (Swap/Move) - Persistent on touch devices/mobile, hover-disclosed on larger screens */}
                                  <div className="flex lg:opacity-0 lg:group-hover/item:opacity-100 transition duration-150 gap-1.5 opacity-100">
                                    {/* Swap Trigger Button */}
                                    <button
                                      onClick={() => handleInitiateSwap(team.id, p.id)}
                                      title="Swap with another player"
                                      className="p-1 text-slate-400 hover:text-blue-600 rounded hover:bg-slate-105 border border-slate-200 transition cursor-pointer"
                                    >
                                      <Shuffle className="h-3 w-3" />
                                    </button>

                                    {/* Move Quick Actions Select */}
                                    <select
                                      className="text-[10px] bg-slate-50 border border-slate-205 text-slate-600 rounded px-1 max-w-[50px] outline-none cursor-pointer"
                                      onChange={(e) => {
                                        const tarId = parseInt(e.target.value, 10);
                                        if (!isNaN(tarId)) handleMovePlayer(p.id, team.id, tarId);
                                        e.target.value = ""; // reset
                                      }}
                                    >
                                      <option value="">Move</option>
                                      {generatedTeams
                                        .filter(t => t.id !== team.id)
                                        .map(t => (
                                          <option key={t.id} value={t.id}>
                                            {t.name}
                                          </option>
                                        ))}
                                    </select>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Team Metrics Footer */}
                        <div className="border-t border-slate-100 px-4 py-3 bg-slate-50/50 flex flex-col gap-2 text-[10px] text-slate-500 font-mono font-medium">
                          <div className="flex items-center justify-between text-slate-600">
                            <span className="font-bold">Balancing Mix</span>
                            <span>Avg Stamina: {team.metrics.avgStamina}</span>
                          </div>
                          
                          {/* Role Breakdown visuals */}
                          <div className="grid grid-cols-4 gap-1 text-center font-bold">
                            <div className="bg-rose-50 text-rose-700 border border-rose-100 py-0.5 rounded">
                              GK: {team.metrics.gkCount}
                            </div>
                            <div className="bg-emerald-50 text-emerald-700 border border-emerald-100 py-0.5 rounded">
                              DEF: {team.metrics.defCount}
                            </div>
                            <div className="bg-blue-50 text-blue-700 border border-blue-105 py-0.5 rounded">
                              MID: {team.metrics.midCount}
                            </div>
                            <div className="bg-amber-50 text-amber-700 border border-amber-100 py-0.5 rounded">
                              ATT: {team.metrics.attCount}
                            </div>
                          </div>

                          {/* Tactical Attributes Spread */}
                          {(team.metrics.poorPositioningCount || team.metrics.lazyCount || team.metrics.slowCount || team.metrics.poorPassingCount || team.metrics.temperamentCount || team.metrics.tenaciousCount || team.metrics.quickCount || team.metrics.communicatorCount || team.metrics.solidCount) ? (
                            <div className="flex flex-wrap gap-1 mt-1.5 border-t border-slate-105/60 pt-2 opacity-95">
                              {team.metrics.poorPositioningCount ? (
                                <span className="bg-rose-50 text-rose-800 border border-rose-100/70 px-1.5 py-0.5 rounded text-[8px] font-bold" title="Players with defensive positional awareness warnings">
                                  Position Limit: {team.metrics.poorPositioningCount}
                                </span>
                              ) : null}
                              {team.metrics.lazyCount ? (
                                <span className="bg-amber-50 text-amber-800 border border-amber-100 px-1.5 py-0.5 rounded text-[8px] font-bold" title="Players with low work-rate or lazy tendencies">
                                  Lazy: {team.metrics.lazyCount}
                                </span>
                              ) : null}
                              {team.metrics.slowCount ? (
                                <span className="bg-slate-100 text-slate-700 border border-slate-200 px-1.5 py-0.5 rounded text-[8px] font-bold" title="Players with speed or joint stamina warnings">
                                  Slow: {team.metrics.slowCount}
                                </span>
                              ) : null}
                              {team.metrics.poorPassingCount ? (
                                <span className="bg-orange-50 text-orange-850 border border-orange-105 px-1.5 py-0.5 rounded text-[8px] font-bold" title="Players with high turnover rate / resists passing">
                                  Ball Loss: {team.metrics.poorPassingCount}
                                </span>
                              ) : null}
                              {team.metrics.temperamentCount ? (
                                <span className="bg-red-50 text-red-800 border border-red-100 px-1.5 py-0.5 rounded text-[8px] font-bold" title="Players with temperament/tantrum warnings when losing">
                                  Temper: {team.metrics.temperamentCount}
                                </span>
                              ) : null}
                              {team.metrics.tenaciousCount ? (
                                <span className="bg-teal-50 text-teal-800 border border-teal-100 px-1.5 py-0.5 rounded text-[8px] font-bold" title="Hardworking / tenacious players">
                                  Tenacious: {team.metrics.tenaciousCount}
                                </span>
                              ) : null}
                              {team.metrics.quickCount ? (
                                <span className="bg-sky-50 text-sky-800 border border-sky-101 px-1.5 py-0.5 rounded text-[8px] font-bold" title="Players with elite swiftness">
                                  Swift: {team.metrics.quickCount}
                                </span>
                              ) : null}
                              {team.metrics.communicatorCount ? (
                                <span className="bg-indigo-50 text-indigo-800 border border-indigo-100 px-1.5 py-0.5 rounded text-[8px] font-bold" title="Vocal organizers / leaders on the field">
                                  Vocal: {team.metrics.communicatorCount}
                                </span>
                              ) : null}
                              {team.metrics.solidCount ? (
                                <span className="bg-emerald-50 text-emerald-800 border border-emerald-100 px-1.5 py-0.5 rounded text-[8px] font-bold" title="Extremely solid players">
                                  Solid: {team.metrics.solidCount}
                                </span>
                              ) : null}
                            </div>
                          ) : null}
                        </div>

                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-500 shadow-sm">
                  <Shuffle className="h-10 w-10 text-slate-300 mx-auto mb-3 animate-pulse" />
                  <p className="text-sm font-bold text-slate-700">No proposed lineups generated</p>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 leading-relaxed">
                    Once attending list matching completes, the generator compiles optimized balanced selections dynamically.
                  </p>
                </div>
              )}

            </div>

          </div>
          </>
        ) : activeTab === 'database' ? (
          /* "Players Matrix" Database Tab Screen details representing CSV edits */
          <div className="flex flex-col gap-6">
            
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 md:gap-8 items-start">
              {/* Matrix Left Column: Raw CSV Configurator */}
              {(currentUser?.role === 'Master Admin' || currentUser?.role === 'Admin') && (
                <div className="lg:col-span-5 flex flex-col gap-6">
                
                {/* Text Editor Box */}
                {currentUser?.role === 'Master Admin' && (
                  <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-3">
                      <div>
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                          <Settings className="h-4 w-4 text-blue-500" />
                          Spreadsheet CSV Editor
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">
                          Edit, copy, or paste player rating rows directly.
                        </p>
                      </div>
                    </div>

                    <textarea
                      className="w-full h-[250px] bg-slate-50 border border-slate-200 rounded-lg p-3 text-[11px] text-slate-700 placeholder-slate-450 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono resize-y overflow-auto"
                      value={csvEditValue}
                      onChange={(e) => {
                        setCsvEditValue(e.target.value);
                        setIsCsvModified(true);
                      }}
                      placeholder="Paste your CSV rows here..."
                    />

                    <div className="mt-4 flex items-center gap-2">
                      <button
                        onClick={handleSaveCsvEditor}
                        disabled={!isCsvModified}
                        className="flex-1 bg-blue-600 hover:bg-blue-705 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs py-2.5 rounded-lg transition cursor-pointer shadow"
                      >
                        Save Changes
                      </button>
                      <button
                        onClick={handleRestoreDefaultCsv}
                        className="bg-white hover:bg-slate-50 border border-slate-300 rounded-lg px-3 py-2.5 text-xs font-semibold text-rose-600 transition cursor-pointer"
                      >
                        Reset Defaults
                      </button>
                    </div>
                  </div>
                )}

                {/* Import/Export dynamic operations box */}
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col gap-4">
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-1">
                      <Share2 className="h-4 w-4 text-emerald-500" />
                      Dynamic Import & Export
                    </h4>
                    <p className="text-xs text-slate-500">
                      Transfer rating spreadsheets dynamically using local files.
                    </p>
                  </div>

                  {/* Drag and Drop Zone */}
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-lg p-4 text-center transition cursor-pointer relative ${
                      isDragging
                        ? 'border-blue-500 bg-blue-50/50 text-blue-700'
                        : 'border-slate-200 hover:border-slate-300 bg-slate-50/50 text-slate-500'
                    }`}
                  >
                    <input
                      type="file"
                      id="csv-file-picker"
                      accept=".csv,.txt"
                      onChange={handleFileSelect}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <Upload className="h-6 w-6 text-slate-400 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-705">
                      Tap or Drag & Drop CSV Spreadsheet here
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Supports direct exports and manual catalogs
                    </p>
                  </div>

                  {uploadError && (
                    <div className="bg-rose-50 border border-rose-100 text-rose-700 px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 leading-relaxed">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      <span>{uploadError}</span>
                    </div>
                  )}

                  {/* Export Options & Reset Section */}
                  <div className="flex flex-col gap-2">
                    <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-slate-800">Export Matrix File</p>
                        <p className="text-[10px] text-slate-500">Get standard .csv backup file</p>
                      </div>
                      <button
                        onClick={handleDownloadCsv}
                        className="bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow transition cursor-pointer"
                      >
                        <Download className="h-3.5 w-3.5 text-blue-600" />
                        Download .CSV
                      </button>
                    </div>

                    {currentUser?.role === 'Admin' && (
                      <div className="bg-rose-50 border border-rose-100 rounded-lg p-3 flex items-center justify-between animate-fade-in">
                        <div>
                          <p className="text-xs font-bold text-rose-800">Reset to Defaults</p>
                          <p className="text-[10px] text-rose-600">Revert entire catalog to baseline</p>
                        </div>
                        <button
                          onClick={handleRestoreDefaultCsv}
                          className="bg-white hover:bg-rose-100 hover:border-rose-300 border border-rose-250 text-rose-700 px-3 py-2 rounded-lg text-xs font-extrabold flex items-center gap-1.5 shadow transition cursor-pointer"
                        >
                          <RotateCcw className="h-3.5 w-3.5 text-rose-600" />
                          Reset Defaults
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Team manager instructions */}
                  <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-3.5 text-[11px] text-blue-800 space-y-2">
                    <p className="font-bold flex items-center gap-1.5 text-blue-900 border-b border-blue-100/60 pb-1.5">
                      <Info className="h-3.5 w-3.5 text-blue-600" />
                      Team Manager Workflow Guide
                    </p>
                    <ol className="list-decimal list-inside space-y-1.5 text-blue-800/90 leading-normal">
                      <li>Click <strong className="text-blue-950 font-bold">Download .CSV</strong> to get the active database.</li>
                      <li>Double-click to open in Microsoft Excel or Google Sheets.</li>
                      <li>Edit and update names, positions, and skill rating values.</li>
                      <li>Export/Save-As from Excel back into standard <strong className="text-blue-950">.CSV</strong> text format.</li>
                      <li>Drag and drop that updated file here in this tab and click save!</li>
                    </ol>
                  </div>

                </div>

              </div>
            )}

              {/* Matrix Right Column: Live Table Grid and search explorer */}
              <div className={`${(currentUser?.role === 'Master Admin' || currentUser?.role === 'Admin') ? 'lg:col-span-7' : 'lg:col-span-12'} bg-white border border-slate-200 rounded-xl p-6 shadow-sm`}>
                
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-105">
                  <div className="flex-1">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                      Ratings Directory view ({databasePlayers.length} total players)
                      <span className="text-[10px] font-mono font-bold text-emerald-600 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded leading-none flex items-center gap-1 shrink-0">
                        ✓ Database Authorized
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 leading-normal">
                      Showing loaded matrix entries with preferred positional rating scores. All authenticated members can append new players or edit individual parameters.
                    </p>
                  </div>

                  {/* Search and download rows */}
                  <div className="flex items-center gap-2 w-full md:w-auto shrink-0 flex-wrap">
                    {/* Add Player button */}
                    <button
                      type="button"
                      onClick={startAddingPlayer}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer shrink-0"
                      title="Add a new player member to the database"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      Add Profile
                    </button>

                    {/* Search input bar */}
                    <div className="relative w-full md:w-48">
                      <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                      <input
                        type="text"
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-850 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                        placeholder="Search name, position, attribute..."
                        value={dbSearch}
                        onChange={(e) => setDbSearch(e.target.value)}
                      />
                    </div>

                    {/* Quick CSV Export on read-only users */}
                    {currentUser?.role === 'User' && (
                      <button
                        type="button"
                        onClick={handleDownloadCsv}
                        className="bg-amber-500 hover:bg-amber-600 border border-transparent text-slate-950 px-2.5 py-1.5 rounded-lg text-xs font-black flex items-center gap-1 shadow-sm transition cursor-pointer shrink-0"
                        title="Export current player spreadsheet catalog"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Export .CSV
                      </button>
                    )}
                  </div>
                </div>

                {/* Collapsible Edit/Add Form Sheet */}
                {(isAddingPlayer || editingPlayer) && (
                  <div className="mb-6 p-5 bg-slate-50 border border-slate-250 rounded-xl shadow-sm animate-fade-in relative">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingPlayer(false);
                        setEditingPlayer(null);
                      }}
                      className="absolute top-4 right-4 p-1.5 rounded-md text-slate-400 hover:text-slate-650 hover:bg-slate-205 transition cursor-pointer"
                      title="Cancel form editing"
                    >
                      <LogOut className="h-4 w-4 rotate-180" />
                    </button>

                    <h3 className="text-xs font-bold text-slate-850 uppercase tracking-widest flex items-center gap-2 border-b border-slate-200 pb-2 mb-4">
                      {isAddingPlayer ? <UserPlus className="h-4 w-4 text-emerald-600" /> : <Sliders className="h-4 w-4 text-amber-550" />}
                      {isAddingPlayer ? 'Add Roster Member' : `Modify Stats for: ${editingPlayer?.fullName}`}
                    </h3>

                    <form onSubmit={handleSavePlayerDetails} className="space-y-4">
                      {/* Name fields */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-slate-550 font-bold uppercase tracking-wider">First Name</label>
                          <input
                            type="text"
                            required
                            placeholder="E.g. David"
                            value={formFirstName}
                            onChange={e => setFormFirstName(e.target.value)}
                            className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-slate-550 font-bold uppercase tracking-wider">Surname</label>
                          <input
                            type="text"
                            placeholder="E.g. Beckham (use '.' if none)"
                            value={formSurname}
                            onChange={e => setFormSurname(e.target.value)}
                            className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                          />
                        </div>
                      </div>

                      {/* Attribute fields */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider">Positive Attribute</label>
                          <input
                            type="text"
                            placeholder="E.g. Pace, Tall, Composed"
                            value={formPositiveAttribute}
                            onChange={e => setFormPositiveAttribute(e.target.value)}
                            className="bg-emerald-50/40 border border-emerald-200 rounded-lg px-3 py-2 text-xs font-mono text-emerald-950 focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder-emerald-600/40"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-rose-700 font-bold uppercase tracking-wider">Negative Attribute</label>
                          <input
                            type="text"
                            placeholder="E.g. No defense"
                            value={formNegativeAttribute}
                            onChange={e => setFormNegativeAttribute(e.target.value)}
                            className="bg-rose-50/40 border border-rose-200 rounded-lg px-3 py-2 text-xs font-mono text-rose-955 focus:outline-none focus:ring-1 focus:ring-rose-500 placeholder-rose-600/40"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-slate-650 font-bold uppercase tracking-wider">Stamina Rating (1-100)</label>
                          <input
                            type="number"
                            min={1}
                            max={100}
                            value={formStamina}
                            onChange={e => setFormStamina(Math.min(100, Math.max(1, parseInt(e.target.value) || 70)))}
                            className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                          />
                        </div>
                      </div>

                      {/* Positional scores grid */}
                      <div className="border border-slate-200 rounded-lg p-3 bg-white">
                        <p className="text-[10px] text-slate-450 font-bold uppercase tracking-widest mb-3 border-b border-slate-100 pb-1.5">
                          Positional Ratings (Goalkeeping, Defense, Midfield, Attack)
                        </p>
                        <div className="grid grid-cols-3 sm:grid-cols-9 gap-2">
                          <div className="flex flex-col gap-0.5">
                            <label className="text-[9px] text-rose-600 font-bold">GK</label>
                            <input
                              type="number" min={1} max={100} value={formGoalkeeper}
                              onChange={e => setFormGoalkeeper(Math.min(100, Math.max(1, parseInt(e.target.value) || 70)))}
                              className="bg-slate-50 border border-slate-205 rounded px-1.5 py-1 text-xs font-mono text-slate-800 text-center"
                            />
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <label className="text-[9px] text-emerald-650 font-semibold">RB</label>
                            <input
                              type="number" min={1} max={100} value={formRightBack}
                              onChange={e => setFormRightBack(Math.min(100, Math.max(1, parseInt(e.target.value) || 70)))}
                              className="bg-slate-50 border border-slate-205 rounded px-1.5 py-1 text-xs font-mono text-slate-805 text-center"
                            />
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <label className="text-[9px] text-emerald-650 font-semibold">LB</label>
                            <input
                              type="number" min={1} max={100} value={formLeftBack}
                              onChange={e => setFormLeftBack(Math.min(100, Math.max(1, parseInt(e.target.value) || 70)))}
                              className="bg-slate-50 border border-slate-205 rounded px-1.5 py-1 text-xs font-mono text-slate-805 text-center"
                            />
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <label className="text-[9px] text-emerald-650 font-semibold">CB</label>
                            <input
                              type="number" min={1} max={100} value={formCentreBack}
                              onChange={e => setFormCentreBack(Math.min(100, Math.max(1, parseInt(e.target.value) || 70)))}
                              className="bg-slate-50 border border-slate-205 rounded px-1.5 py-1 text-xs font-mono text-slate-805 text-center"
                            />
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <label className="text-[9px] text-blue-650 font-semibold">DMF</label>
                            <input
                              type="number" min={1} max={100} value={formDefensiveMidfielder}
                              onChange={e => setFormDefensiveMidfielder(Math.min(100, Math.max(1, parseInt(e.target.value) || 70)))}
                              className="bg-slate-50 border border-slate-205 rounded px-1.5 py-1 text-xs font-mono text-slate-805 text-center"
                            />
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <label className="text-[9px] text-blue-650 font-semibold">Mid</label>
                            <input
                              type="number" min={1} max={100} value={formMidfielder}
                              onChange={e => setFormMidfielder(Math.min(100, Math.max(1, parseInt(e.target.value) || 70)))}
                              className="bg-slate-50 border border-slate-205 rounded px-1.5 py-1 text-xs font-mono text-slate-850 text-center"
                            />
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <label className="text-[9px] text-blue-650 font-semibold">AM</label>
                            <input
                              type="number" min={1} max={100} value={formAttackingMidfielder}
                              onChange={e => setFormAttackingMidfielder(Math.min(100, Math.max(1, parseInt(e.target.value) || 70)))}
                              className="bg-slate-50 border border-slate-205 rounded px-1.5 py-1 text-xs font-mono text-slate-855 text-center"
                            />
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <label className="text-[9px] text-amber-650 font-semibold">Wgr</label>
                            <input
                              type="number" min={1} max={100} value={formWinger}
                              onChange={e => setFormWinger(Math.min(100, Math.max(1, parseInt(e.target.value) || 70)))}
                              className="bg-slate-50 border border-slate-205 rounded px-1.5 py-1 text-xs font-mono text-slate-850 text-center"
                            />
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <label className="text-[9px] text-amber-655 font-bold">Str</label>
                            <input
                              type="number" min={1} max={100} value={formStriker}
                              onChange={e => setFormStriker(Math.min(100, Math.max(1, parseInt(e.target.value) || 70)))}
                              className="bg-slate-50 border border-slate-205 rounded px-1.5 py-1 text-xs font-mono text-slate-850 text-center"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-200">
                        <button
                          type="button"
                          onClick={() => {
                            setIsAddingPlayer(false);
                            setEditingPlayer(null);
                          }}
                          className="px-4 py-2 border border-slate-300 text-slate-705 text-xs font-bold rounded-lg hover:bg-slate-100 transition cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black tracking-tight rounded-lg shadow-sm transition cursor-pointer"
                        >
                          {isAddingPlayer ? 'Add New Player' : 'Save Details'}
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                <div className="overflow-x-auto max-h-[400px] overflow-y-auto border border-slate-200 rounded-lg shadow-inner">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-550 border-b border-slate-200 font-bold uppercase tracking-wider text-[10px]">
                        <th className="p-3">Player Details</th>
                        <th className="p-3">Favored Position</th>
                        <th className="p-3 text-center">Score Profile</th>
                        <th className="p-3 text-center">Stamina</th>
                        <th className="p-3">Tactical traits</th>
                        <th className="p-3 text-center">Manage</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredDbPlayers.length > 0 ? (
                        filteredDbPlayers.map((p) => {
                          const role = getPlayerRole(p);
                          let roleBadgeColor = 'bg-blue-50 text-blue-700 border-blue-200';
                          if (role === 'GK') roleBadgeColor = 'bg-rose-50 text-rose-700 border-rose-200';
                          if (role === 'DEF') roleBadgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                          if (role === 'ATT') roleBadgeColor = 'bg-amber-50 text-amber-700 border-amber-200';

                          return (
                            <tr key={p.id} className="hover:bg-slate-50/50 transition duration-150">
                              <td className="p-3 font-semibold text-slate-705">
                                {p.fullName}
                              </td>
                              <td className="p-3 text-slate-500">
                                <span className={`text-[9px] px-1.5 py-0.5 rounded border ${roleBadgeColor} font-bold mr-1.5`}>
                                  {role}
                                </span>
                                {p.bestPosition}
                              </td>
                              <td className="p-3 text-center font-mono font-bold text-blue-600 bg-blue-50/20">
                                {p.bestRating}
                              </td>
                              <td className="p-3 text-center font-mono text-slate-450">
                                {p.stamina || 70}
                              </td>
                              <td className="p-3 text-slate-500 space-y-1">
                                {p.positiveAttribute && (
                                  <div className="text-[10px] text-emerald-600 font-mono bg-emerald-50 px-1.5 py-0.5 rounded inline-block">
                                    + {p.positiveAttribute}
                                  </div>
                                )}
                                {p.negativeAttribute && (
                                  <div className="text-[10px] text-rose-600/90 font-mono bg-rose-50 px-1.5 py-0.5 rounded inline-block ml-1">
                                    - {p.negativeAttribute}
                                  </div>
                                )}
                              </td>
                              <td className="p-3 text-center">
                                <div className="flex items-center justify-center gap-1.5 flex-wrap md:flex-nowrap">
                                  <button
                                    type="button"
                                    onClick={() => startEditingPlayer(p)}
                                    className="p-1 px-2.5 bg-slate-105 hover:bg-amber-100 text-slate-705 hover:text-amber-900 border border-slate-200/60 hover:border-amber-300 rounded text-[10px] font-bold flex items-center justify-center gap-1 transition cursor-pointer"
                                    title={`Edit ${p.fullName}'s stats & attributes`}
                                  >
                                    <Sliders className="h-3 w-3 text-amber-600" />
                                    Edit
                                  </button>
                                  {(currentUser?.role === 'Master Admin' || currentUser?.role === 'Admin') && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeletePlayerFromMatrix(p.id, p.fullName)}
                                      className="p-1 px-2 bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 border border-rose-200 rounded text-[10px] font-extrabold flex items-center justify-center gap-1 transition cursor-pointer"
                                      title={`Permanently delete ${p.fullName}`}
                                    >
                                      <Trash2 className="h-3 w-3 text-rose-500" />
                                      Delete
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-slate-400 italic">
                            No directory matches.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

              </div>
              
            </div>

          </div>
        ) : (
          /* "Access Control" Tab Screen details representing local IAM controls */
          <div className="flex flex-col gap-6 animate-fade-in">
            <div className="bg-[#681414] border border-amber-500/20 text-white p-5 rounded-xl shadow-lg flex items-center gap-4 relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(#ffffff04_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />
              <Shield className="h-10 w-10 text-amber-400 shrink-0 animate-pulse" />
              <div>
                <h2 className="text-lg font-black tracking-tight text-white flex items-center gap-1.5 font-serif">
                  Identity & Access Control Center
                  <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded ml-1">LOCAL IAM</span>
                </h2>
                <p className="text-xs text-red-100/80 mt-1 max-w-2xl leading-relaxed font-medium">
                  Protect player stats and balancer parameters from accidental tampering. Administered team members can utilize standard dashboards and match fuzzy indicators but are locked from altering canonical catalog profiles.
                </p>
              </div>
            </div>

            <div className={(currentUser?.role === 'Master Admin' || currentUser?.role === 'Admin') ? "grid grid-cols-1 lg:grid-cols-12 gap-5 md:gap-8 items-start" : "max-w-xl mx-auto w-full"}>
              {/* Security Left: Profile Management Forms */}
              <div className={(currentUser?.role === 'Master Admin' || currentUser?.role === 'Admin') ? "lg:col-span-5 flex flex-col gap-6" : "flex flex-col gap-6"}>
                
                {/* Card 1: Register New Profile */}
                {(currentUser?.role === 'Master Admin' || currentUser?.role === 'Admin') && (
                  <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
                      <UserPlus className="h-4 w-4 text-emerald-600" />
                      Register Team Profile
                    </h3>
 
                    <form onSubmit={handleCreateUser} className="flex flex-col gap-3.5">
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                          Profile/Member Name
                        </label>
                        <input
                          type="text"
                          placeholder="E.g. Rohit, Lee, Coach Dave"
                          value={newUserName}
                          onChange={(e) => setNewUserName(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                          required
                        />
                      </div>
 
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                          Assigned Role Privilege
                        </label>
                        <select
                          value={newUserRole}
                          onChange={(e) => setNewUserRole(e.target.value as 'Master Admin' | 'Admin' | 'User')}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
                        >
                          <option value="User">Standard Player (User - Read Only Catalog)</option>
                          <option value="Admin">Full Coordinator (Admin - Allow Database Edits)</option>
                          {currentUser?.role === 'Master Admin' && (
                            <option value="Master Admin">Master Admin (Full Systems Controller)</option>
                          )}
                        </select>
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                          Access PIN Passcode (Exactly 6 digits only)
                        </label>
                        <input
                          type="text"
                          pattern="\d*"
                          maxLength={6}
                          placeholder="E.g. 529148"
                          value={newUserPin}
                          onChange={(e) => setNewUserPin(e.target.value.replace(/\D/g, ''))}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-xs font-mono tracking-widest focus:outline-none focus:ring-1 focus:ring-amber-500"
                          required
                        />
                      </div>

                      {newUserError && (
                        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-2.5 rounded-lg text-[10.5px] font-semibold">
                          ⚠️ {newUserError}
                        </div>
                      )}

                      <button
                        type="submit"
                        className="w-full bg-amber-500 hover:bg-amber-600 active:scale-[0.99] text-slate-950 font-black tracking-tight text-xs py-2 rounded-lg transition-all cursor-pointer shadow flex items-center justify-center gap-1 mt-2 font-bold"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Generate Profile Credentials
                      </button>
                    </form>
                  </div>
                )}

                {/* Card 2: Update Your Credentials */}
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col gap-5">
                  <div>
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
                      <User className="h-4 w-4 text-blue-500" />
                      Personal Profile Settings
                    </h3>

                    {/* Form A: Change Profile/Member Name */}
                    <form onSubmit={handleUpdateOwnName} className="flex flex-col gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                          Update Member Profile Name
                        </label>
                        <input
                          type="text"
                          placeholder="E.g. Lee Siqi"
                          value={ownNameValue}
                          onChange={(e) => {
                            setOwnNameValue(e.target.value);
                            setOwnNameError(null);
                          }}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                          required
                        />
                      </div>

                      {ownNameError && (
                        <div className="bg-rose-50 border border-rose-100 text-rose-700 p-2 rounded text-[10.5px]">
                          ⚠️ {ownNameError}
                        </div>
                      )}

                      {ownNameSuccess && (
                        <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 p-2 rounded text-[10.5px] font-bold">
                          ✓ {ownNameSuccess}
                        </div>
                      )}

                      <button
                        type="submit"
                        className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs py-2 rounded-lg transition-all cursor-pointer shadow flex items-center justify-center gap-1.5 mt-1"
                      >
                        <RotateCcw className="h-3.5 w-3.5 text-slate-400" />
                        Apply Name Change
                      </button>
                    </form>
                  </div>

                  <div className="border-t border-slate-100 pt-5">
                    <h4 className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-2 mb-3">
                      <Key className="h-3.5 w-3.5 text-amber-500" />
                      Security PIN passcode
                    </h4>

                    {/* Form B: Update PIN Passcode */}
                    <form onSubmit={handleChangeOwnPin} className="flex flex-col gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                          Verify Current PIN
                        </label>
                        <input
                          type="password"
                          pattern="\d*"
                          maxLength={6}
                          placeholder="••••••"
                          value={changePinOld}
                          onChange={(e) => setChangePinOld(e.target.value.replace(/\D/g, ''))}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                          required
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                            New Secure PIN (6 digits only)
                          </label>
                          <input
                            type="password"
                            pattern="\d*"
                            maxLength={6}
                            placeholder="••••••"
                            value={changePinNew}
                            onChange={(e) => setChangePinNew(e.target.value.replace(/\D/g, ''))}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                            required
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                            Confirm PIN (6 digits only)
                          </label>
                          <input
                            type="password"
                            pattern="\d*"
                            maxLength={6}
                            placeholder="••••••"
                            value={changePinConfirm}
                            onChange={(e) => setChangePinConfirm(e.target.value.replace(/\D/g, ''))}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                            required
                          />
                        </div>
                      </div>

                      {changePinError && (
                        <div className="bg-rose-50 border border-rose-100 text-rose-700 p-2 rounded text-[10.5px]">
                          ⚠️ {changePinError}
                        </div>
                      )}

                      {changePinSuccess && (
                        <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 p-2 rounded text-[10.5px] font-bold">
                          ✓ {changePinSuccess}
                        </div>
                      )}

                      <button
                        type="submit"
                        className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs py-2 rounded-lg transition-all cursor-pointer shadow flex items-center justify-center gap-1.5 mt-1"
                      >
                        <RotateCcw className="h-3.5 w-3.5 text-slate-400" />
                        Update PIN Passcode
                      </button>
                    </form>
                  </div>
                </div>

              </div>

              {/* Security Right: Active Roster */}
              {(currentUser?.role === 'Master Admin' || currentUser?.role === 'Admin') && (
                <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4 font-sans">
                  <h3 className="text-xs font-bold text-slate-850 uppercase tracking-widest flex items-center gap-2">
                    <Fingerprint className="h-4 w-4 text-blue-500 animate-pulse" />
                    Authorized Access Directory ({iamUsers.length})
                  </h3>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Secured Locally
                  </span>
                </div>

                <p className="text-xs text-slate-500 leading-relaxed mb-4">
                  Registered profiles represent the active list of users who can sign in to manage squad parameters. Share assigned PIN codes directly with your coordinators.
                </p>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-slate-400 text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-450 font-bold uppercase text-[9px] tracking-wider bg-slate-50/75">
                        <th className="py-2.5 px-3">Member Profile</th>
                        <th className="py-2.5 px-3">Role Privilege</th>
                        <th className="py-2.5 px-3 text-center">Assigned PIN</th>
                        <th className="py-2.5 px-3 text-right">Database Access</th>
                        <th className="py-2.5 px-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {iamUsers.map((user) => {
                        const isSelf = currentUser?.id === user.id;
                        const isMaster = user.id === 'admin-master';
                        return (
                          <tr key={user.id} className="border-b border-slate-100 font-medium hover:bg-slate-105/40 text-slate-700 transition">
                            <td className="py-3 px-3">
                              <div className="font-extrabold text-slate-900 font-sans flex items-center gap-1.5 flex-wrap">
                                <span>{user.name}</span>
                                {isSelf && (
                                  <span className="text-[8px] bg-blue-100 text-blue-850 px-1 py-0.5 rounded font-bold shrink-0">
                                    YOU
                                  </span>
                                )}
                                {canRenameUser(user) && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenRename(user.id)}
                                    className="p-0.5 hover:bg-slate-100 border border-transparent hover:border-slate-250 rounded text-slate-400 hover:text-blue-600 transition cursor-pointer inline-flex items-center justify-center"
                                    title={`Rename profile for ${user.name}`}
                                  >
                                    <Edit2 className="h-2.5 w-2.5" />
                                  </button>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                Created: {new Date(user.createdAt).toLocaleDateString()}
                              </div>
                            </td>
                            <td className="py-2.5 px-3">
                              {canModifyRole(user) ? (
                                <select
                                  value={user.role}
                                  onChange={(e) => handleUpdateUserRole(user.id, e.target.value as any)}
                                  className="text-[10px] bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 rounded px-1.5 py-1 text-slate-850 font-mono font-black focus:ring-1 focus:ring-amber-500/50 outline-none cursor-pointer transition-all"
                                >
                                  <option value="User">👤 USER</option>
                                  <option value="Admin">🛡️ ADMIN</option>
                                  {currentUser?.role === 'Master Admin' && (
                                    <option value="Master Admin">👑 MASTER ADMIN</option>
                                  )}
                                </select>
                              ) : (
                                user.role === 'Master Admin' ? (
                                  <span className="text-[9px] bg-rose-50 text-rose-900 border border-rose-500/10 px-1.5 py-0.5 rounded font-mono font-black">
                                    👑 MASTER ADMIN
                                  </span>
                                ) : user.role === 'Admin' ? (
                                  <span className="text-[9px] bg-amber-50 text-amber-900 border border-amber-500/10 px-1.5 py-0.5 rounded font-mono font-black">
                                    🛡️ ADMIN
                                  </span>
                                ) : (
                                  <span className="text-[9px] bg-slate-105 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                                    👤 USER
                                  </span>
                                )
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span className="font-mono bg-slate-50 px-2 py-1 rounded border border-slate-205 font-extrabold text-slate-800 text-xs">
                                {(() => {
                                  if (!currentUser) return '••••••';
                                  if (currentUser.role === 'Master Admin') return user.pin;
                                  if (currentUser.role === 'Admin') {
                                    return user.role === 'User' ? user.pin : '••••••';
                                  }
                                  return '••••••';
                                })()}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-[11px]">
                              {user.role === 'Master Admin' ? (
                                <span className="text-rose-700 font-bold">System Root</span>
                              ) : user.role === 'Admin' ? (
                                <span className="text-emerald-700 font-bold">Read / Write</span>
                              ) : (
                                <span className="text-slate-500">Read Only</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {isMaster ? (
                                <span className="text-[9px] text-slate-400 font-medium bg-slate-100 px-2 py-1 rounded animate-pulse" title="The master admin profile is mandatory for security backups.">
                                  Default Card
                                </span>
                              ) : (
                                <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                  {/* Reset PIN Button */}
                                  {((currentUser?.role === 'Master Admin' && !isSelf) || 
                                    (currentUser?.role === 'Admin' && !isSelf && user.role !== 'Master Admin')) && (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenPinReset(user.id)}
                                      className="p-1 px-2.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 hover:text-amber-800 rounded text-[10px] font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                                      title={`Reset PIN passcode for ${user.name}`}
                                    >
                                      <Key className="h-3 w-3 text-amber-500" />
                                      Reset
                                    </button>
                                  )}

                                  {/* Delete Profile button */}
                                  {isSelf ? (
                                    <span className="text-[9px] text-blue-700 font-semibold bg-blue-50 px-2.5 py-1.5 rounded">
                                      Active Session
                                    </span>
                                  ) : (
                                    (currentUser?.role === 'Master Admin' || (currentUser?.role === 'Admin' && user.role !== 'Master Admin')) ? (
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteUser(user.id)}
                                        className="p-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 hover:text-rose-700 rounded-lg transition cursor-pointer"
                                        title={`Revoke credentials for ${user.name}`}
                                      >
                                        <UserX className="h-3.5 w-3.5" />
                                      </button>
                                    ) : (
                                      <span className="text-[9px] text-slate-400 bg-slate-50/70 px-2 py-1 rounded inline-flex items-center gap-1 border border-slate-200/50">
                                        <Lock className="h-2.5 w-2.5 text-slate-400" /> Locked
                                      </span>
                                    )
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Local Security Guidelines Removed */}
              </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Bespoke Interactive Alert & Confirmation Dialog Overlay */}
      {dialogConfig.isOpen && (
        <div 
          className="fixed inset-0 z-[99999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          style={{ animation: 'fadeIn 0.15s ease-out' }}
        >
          <div 
            className="bg-white rounded-2xl border border-slate-250 shadow-2xl max-w-sm w-full overflow-hidden p-6 relative font-sans animate-scale-up"
            style={{ animation: 'scaleUp 0.18s cubic-bezier(0.16, 1, 0.3, 1)' }}
          >
            <div className="flex gap-4 items-start">
              <div className={`p-3 rounded-full shrink-0 ${dialogConfig.type === 'confirm' ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-blue-600'}`}>
                {dialogConfig.type === 'confirm' ? (
                  <ShieldAlert className="h-6 w-6" />
                ) : (
                  <AlertCircle className="h-6 w-6" />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-black text-slate-900 tracking-tight">
                  {dialogConfig.title}
                </h3>
                <p className="text-xs text-slate-550 leading-relaxed mt-1.5 font-medium whitespace-pre-line">
                  {dialogConfig.message}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 mt-6 pt-3 border-t border-slate-100">
              {dialogConfig.type === 'confirm' ? (
                <>
                  <button
                    type="button"
                    onClick={() => setDialogConfig(prev => ({ ...prev, isOpen: false }))}
                    className="px-3.5 py-2 text-slate-600 hover:text-slate-800 hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold transition cursor-pointer"
                  >
                    No, Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      dialogConfig.onConfirm();
                    }}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white rounded-lg text-xs font-black transition-all cursor-pointer shadow-sm"
                  >
                    Confirm Action
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setDialogConfig(prev => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white rounded-lg text-xs font-black transition-all cursor-pointer shadow-sm w-full text-center"
                >
                  Understood
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bespoke PIN Reset Modal Overlay */}
      {pinResetUserId && (
        <div 
          className="fixed inset-0 z-[99999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          style={{ animation: 'fadeIn 0.15s ease-out' }}
        >
          <div 
            className="bg-white rounded-2xl border border-slate-250 shadow-2xl max-w-sm w-full overflow-hidden p-6 relative font-sans animate-scale-up"
            style={{ animation: 'scaleUp 0.18s cubic-bezier(0.16, 1, 0.3, 1)' }}
          >
            <div className="flex gap-4 items-start">
              <div className="p-3 rounded-full shrink-0 bg-amber-50 text-amber-600">
                <Key className="h-6 w-6" />
              </div>
              
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-black text-slate-900 tracking-tight">
                  Reconfigure Passcode PIN
                </h3>
                <p className="text-xs text-slate-550 leading-relaxed mt-1 font-medium">
                  Enter a new 6-digit passcode PIN for <strong className="text-slate-900">"{iamUsers.find(u => u.id === pinResetUserId)?.name}"</strong>.
                </p>
              </div>
            </div>

            <form onSubmit={handleApplyPinReset} className="mt-4 space-y-3.5">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                  New 6-Digit PIN passcode
                </label>
                <input
                  type="password"
                  pattern="\d*"
                  maxLength={6}
                  placeholder="••••••"
                  value={resetPinValue}
                  onChange={(e) => {
                    setResetPinValue(e.target.value.replace(/\D/g, ''));
                    setResetPinError(null);
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-850 text-center tracking-widest text-lg font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                  required
                  autoFocus
                />
              </div>

              {resetPinError && (
                <div className="text-[10.5px] font-semibold text-rose-600 bg-rose-50 border border-rose-200/50 p-2 rounded-lg">
                  ⚠️ {resetPinError}
                </div>
              )}

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPinResetUserId(null)}
                  className="px-3.5 py-2 text-slate-600 hover:text-slate-800 hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg text-xs font-black transition-all cursor-pointer shadow-sm"
                >
                  Apply Passcode
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bespoke Rename Member Modal Overlay */}
      {renameUserId && (
        <div 
          className="fixed inset-0 z-[99999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          style={{ animation: 'fadeIn 0.15s ease-out' }}
        >
          <div 
            className="bg-white rounded-2xl border border-slate-250 shadow-2xl max-w-sm w-full overflow-hidden p-6 relative font-sans animate-scale-up"
            style={{ animation: 'scaleUp 0.18s cubic-bezier(0.16, 1, 0.3, 1)' }}
          >
            <div className="flex gap-4 items-start">
              <div className="p-3 rounded-full shrink-0 bg-blue-50 text-blue-600">
                <Edit2 className="h-6 w-6" />
              </div>
              
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-black text-slate-900 tracking-tight">
                  Rename Member Profile
                </h3>
                <p className="text-xs text-slate-550 leading-relaxed mt-1 font-medium">
                  Enter a new member/profile name for <strong className="text-slate-900">"{iamUsers.find(u => u.id === renameUserId)?.name}"</strong>.
                </p>
              </div>
            </div>

            <form onSubmit={handleApplyRename} className="mt-4 space-y-3.5">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                  New Member Name
                </label>
                <input
                  type="text"
                  placeholder="E.g. Lee Siqi"
                  value={renameValue}
                  onChange={(e) => {
                    setRenameValue(e.target.value);
                    setRenameError(null);
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-850 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-amber-500"
                  required
                  autoFocus
                />
              </div>

              {renameError && (
                <div className="text-[10.5px] font-semibold text-rose-600 bg-rose-50 border border-rose-200/50 p-2 rounded-lg">
                  ⚠️ {renameError}
                </div>
              )}

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRenameUserId(null)}
                  className="px-3.5 py-2 text-slate-600 hover:text-slate-800 hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-black transition-all cursor-pointer shadow-sm"
                >
                  Apply Name
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
