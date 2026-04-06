import React, { useState, useRef, useEffect } from 'react';
import { MapPin, Phone, Mail, Clock, ChevronRight, Dumbbell, Activity, Users, ArrowUpRight, Check, Target, Camera, BookOpen, Star, Trash2, Shield, LogOut, ChevronLeft, Heart, MessageSquare, X, Menu, User } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db, signInWithGoogle, logOut } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc, setDoc, getDoc } from 'firebase/firestore';

// Image compression helper to stay under 1MB Firestore limit
const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

export default function App() {
  const phoneNumber = "09186602080";
  const email = "ronaldmagpugay@gmail.com";
  const mapsLink = "https://maps.app.goo.gl/AVssFSXu3N7TSp4DA";
  const address = "Block 20 Lot 8, St Joseph 7, Marinig, Cabuyao City, 4025 Laguna";

  const fadeIn = {
    initial: { opacity: 0, y: 20 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true },
    transition: { duration: 0.6 }
  };

  // UI States
  const [toast, setToast] = useState<{show: boolean, message: string, type: 'success' | 'error'}>({show: false, message: '', type: 'success'});
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({show: true, message, type});
    setTimeout(() => setToast(prev => ({...prev, show: false})), 3000);
  };

  const [confirmDialog, setConfirmDialog] = useState<{isOpen: boolean, message: string, onConfirm: () => void}>({isOpen: false, message: '', onConfirm: () => {}});

  // Auth State
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Check if user exists in db, if not create as 'user'
        const userRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);
        
        let role = 'user';
        if (!userSnap.exists()) {
          // Default admin email check
          if (currentUser.email === 'likhemayt@gmail.com') {
            role = 'admin';
          }
          await setDoc(userRef, {
            email: currentUser.email,
            name: currentUser.displayName,
            role: role
          });
        } else {
          role = userSnap.data().role;
        }
        setIsAdmin(role === 'admin');
      } else {
        setIsAdmin(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // Gallery State
  const [gallery, setGallery] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = query(collection(db, 'gallery'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setGallery(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user) {
      showToast("Please sign in to upload photos.", "error");
      return;
    }
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressedBase64 = await compressImage(file);
        await addDoc(collection(db, 'gallery'), {
          imageUrl: compressedBase64,
          uploaderId: user.uid,
          createdAt: new Date().toISOString()
        });
        showToast("Photo uploaded successfully!");
      } catch (error) {
        console.error("Error uploading image:", error);
        showToast("Failed to upload image. It might be too large.", "error");
      }
    }
  };

  const handleDeleteImage = async (id: string) => {
    setConfirmDialog({
      isOpen: true,
      message: "Are you sure you want to delete this image?",
      onConfirm: async () => {
        await deleteDoc(doc(db, 'gallery', id));
        setConfirmDialog(prev => ({...prev, isOpen: false}));
        showToast("Image deleted.");
      }
    });
  };

  // Testimonials State
  const [testimonials, setTestimonials] = useState<any[]>([]);
  const [newTestimonial, setNewTestimonial] = useState({ name: "", text: "" });
  const [testimonialImageFile, setTestimonialImageFile] = useState<File | null>(null);
  const [currentTestimonialIdx, setCurrentTestimonialIdx] = useState(0);

  useEffect(() => {
    const q = query(collection(db, 'testimonials'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTestimonials(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  const approvedTestimonials = testimonials.filter(t => t.status === 'approved');

  const nextTestimonial = () => {
    setCurrentTestimonialIdx((prev) => (prev + 1) % approvedTestimonials.length);
  };

  const prevTestimonial = () => {
    setCurrentTestimonialIdx((prev) => (prev - 1 + approvedTestimonials.length) % approvedTestimonials.length);
  };

  const handleTestimonialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      showToast("Please sign in to submit a testimonial.", "error");
      return;
    }
    if (newTestimonial.name && newTestimonial.text) {
      let imageUrl = "";
      if (testimonialImageFile) {
        try {
          imageUrl = await compressImage(testimonialImageFile);
        } catch (err) {
          showToast("Failed to process image.", "error");
          return;
        }
      }

      await addDoc(collection(db, 'testimonials'), {
        name: newTestimonial.name,
        text: newTestimonial.text,
        imageUrl: imageUrl,
        rating: 5,
        status: 'pending',
        createdAt: new Date().toISOString()
      });
      setNewTestimonial({ name: "", text: "" });
      setTestimonialImageFile(null);
      showToast("Testimonial submitted for approval!");
    }
  };

  const handleApproveTestimonial = async (id: string) => {
    await updateDoc(doc(db, 'testimonials', id), { status: 'approved' });
    showToast("Testimonial approved!");
  };

  const handleDeleteTestimonial = async (id: string) => {
    setConfirmDialog({
      isOpen: true,
      message: "Delete this testimonial?",
      onConfirm: async () => {
        await deleteDoc(doc(db, 'testimonials', id));
        setConfirmDialog(prev => ({...prev, isOpen: false}));
        showToast("Testimonial deleted.");
      }
    });
  };

  // Blogs State
  const [blogs, setBlogs] = useState<any[]>([]);
  const [newBlog, setNewBlog] = useState({ title: "", excerpt: "", content: "" });
  const [blogImageFile, setBlogImageFile] = useState<File | null>(null);
  const [selectedBlog, setSelectedBlog] = useState<any | null>(null);
  const [blogComments, setBlogComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");

  useEffect(() => {
    const q = query(collection(db, 'blogs'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setBlogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  // Fetch comments when a blog is selected
  useEffect(() => {
    if (selectedBlog) {
      // Keep selectedBlog in sync with the main blogs array (for likes)
      const updatedBlog = blogs.find(b => b.id === selectedBlog.id);
      if (updatedBlog && JSON.stringify(updatedBlog.likes) !== JSON.stringify(selectedBlog.likes)) {
        setSelectedBlog(updatedBlog);
      }

      const q = query(collection(db, 'blogs', selectedBlog.id, 'comments'), orderBy('createdAt', 'desc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setBlogComments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });
      return () => unsubscribe();
    }
  }, [selectedBlog, blogs]);

  const handleBlogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    if (newBlog.title && newBlog.excerpt && newBlog.content) {
      let imageUrl = null;
      if (blogImageFile) {
        try {
          imageUrl = await compressImage(blogImageFile);
        } catch (err) {
          showToast("Failed to compress blog image.", "error");
          return;
        }
      }

      await addDoc(collection(db, 'blogs'), {
        ...newBlog,
        authorName: user.displayName || user.email,
        authorId: user.uid,
        imageUrl,
        likes: [],
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        createdAt: new Date().toISOString()
      });
      setNewBlog({ title: "", excerpt: "", content: "" });
      setBlogImageFile(null);
      showToast("Blog published!");
    }
  };

  const handleLikeBlog = async (blogId: string, currentLikes: string[] = []) => {
    if (!user) {
      showToast("Please sign in to like a blog.", "error");
      return;
    }
    const hasLiked = currentLikes.includes(user.uid);
    const newLikes = hasLiked 
      ? currentLikes.filter(id => id !== user.uid)
      : [...currentLikes, user.uid];
      
    await updateDoc(doc(db, 'blogs', blogId), { likes: newLikes });
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      showToast("Please sign in to comment.", "error");
      return;
    }
    if (newComment.trim() && selectedBlog) {
      await addDoc(collection(db, 'blogs', selectedBlog.id, 'comments'), {
        text: newComment.trim(),
        authorName: user.displayName || user.email,
        authorId: user.uid,
        createdAt: new Date().toISOString()
      });
      setNewComment("");
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (selectedBlog) {
      await deleteDoc(doc(db, 'blogs', selectedBlog.id, 'comments', commentId));
    }
  };

  const handleDeleteBlog = async (id: string) => {
    setConfirmDialog({
      isOpen: true,
      message: "Delete this blog post?",
      onConfirm: async () => {
        await deleteDoc(doc(db, 'blogs', id));
        setConfirmDialog(prev => ({...prev, isOpen: false}));
        showToast("Blog post deleted.");
      }
    });
  };

  return (
    <div className="min-h-screen bg-gym-black selection:bg-gym-beige selection:text-gym-black relative">
      <div className="fixed inset-0 bg-noise z-50 pointer-events-none mix-blend-overlay"></div>
      
      {/* Toast Notification */}
      <AnimatePresence>
        {toast.show && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={`fixed bottom-6 right-6 z-[70] px-6 py-3 rounded-xl shadow-2xl font-medium ${toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-gym-beige text-gym-black'}`}
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirm Dialog */}
      <AnimatePresence>
        {confirmDialog.isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] bg-black/80 flex items-center justify-center px-4"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-zinc-900 border border-gym-beige/20 p-8 rounded-2xl max-w-md w-full text-center"
            >
              <h3 className="text-xl font-bold text-white mb-6">{confirmDialog.message}</h3>
              <div className="flex gap-4 justify-center">
                <button
                  onClick={() => setConfirmDialog(prev => ({...prev, isOpen: false}))}
                  className="px-6 py-2 rounded-xl border border-gray-600 text-gray-300 hover:bg-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDialog.onConfirm}
                  className="px-6 py-2 rounded-xl bg-red-500 text-white hover:bg-red-600 transition-colors font-bold"
                >
                  Confirm
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-40 glass border-b-0">
        <div className="max-w-7xl mx-auto px-6 h-24 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              className="sm:hidden p-2 -ml-2 text-gym-beige hover:text-white transition-colors"
              onClick={() => setShowMobileMenu(!showMobileMenu)}
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="font-display font-bold text-xl sm:text-2xl tracking-tighter text-gym-beige flex items-center gap-2">
              <div className="w-8 h-8 bg-gym-beige rounded-sm flex items-center justify-center text-gym-black shrink-0">
                <Dumbbell className="w-5 h-5" />
              </div>
              <span className="hidden xs:inline">4M- R FITNESS</span>
              <span className="xs:hidden">4M-R</span>
            </div>
          </div>
          <div className="flex items-center gap-4 sm:gap-6">
            {user ? (
              <div className="hidden sm:flex items-center gap-6">
                {isAdmin && (
                  <button 
                    onClick={() => setShowAdminPanel(!showAdminPanel)}
                    className="flex items-center gap-2 text-sm font-medium text-gym-beige hover:text-white transition-colors uppercase tracking-widest"
                  >
                    <Shield className="w-4 h-4" />
                    Admin
                  </button>
                )}
                <button 
                  onClick={logOut}
                  className="flex items-center gap-2 text-sm font-medium text-gray-400 hover:text-white transition-colors uppercase tracking-widest"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            ) : (
              <button 
                onClick={signInWithGoogle}
                className="hidden sm:flex items-center gap-2 text-sm font-medium text-gym-beige hover:text-white transition-colors uppercase tracking-widest"
              >
                Sign In
              </button>
            )}
            <a 
              href={`tel:${phoneNumber}`}
              className="group relative flex items-center gap-2 text-sm font-bold bg-gym-beige text-gym-black px-4 sm:px-6 py-3 rounded-full overflow-hidden transition-all hover:scale-105 active:scale-95"
            >
              <div className="absolute inset-0 bg-white translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
              <Phone className="w-4 h-4 relative z-10" />
              <span className="hidden sm:inline relative z-10 uppercase tracking-wider">Call Now</span>
            </a>
          </div>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {showMobileMenu && (
          <motion.div
            initial={{ opacity: 0, x: -300 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -300 }}
            className="fixed inset-y-0 left-0 z-50 w-64 bg-zinc-950 border-r border-gym-beige/10 shadow-2xl p-6 flex flex-col sm:hidden"
          >
            <div className="flex justify-between items-center mb-12">
              <div className="font-display font-bold text-xl tracking-tighter text-gym-beige flex items-center gap-2">
                <div className="w-8 h-8 bg-gym-beige rounded-sm flex items-center justify-center text-gym-black shrink-0">
                  <Dumbbell className="w-5 h-5" />
                </div>
                4M-R
              </div>
              <button onClick={() => setShowMobileMenu(false)} className="text-gray-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex flex-col gap-6">
              {user ? (
                <>
                  <div className="text-sm text-gray-500 mb-2 truncate">Signed in as {user.email}</div>
                  {isAdmin && (
                    <button 
                      onClick={() => {
                        setShowAdminPanel(true);
                        setShowMobileMenu(false);
                      }}
                      className="flex items-center gap-3 text-lg font-medium text-gym-beige hover:text-white transition-colors uppercase tracking-widest"
                    >
                      <Shield className="w-5 h-5" />
                      Admin Panel
                    </button>
                  )}
                  <button 
                    onClick={() => {
                      logOut();
                      setShowMobileMenu(false);
                    }}
                    className="flex items-center gap-3 text-lg font-medium text-gray-400 hover:text-white transition-colors uppercase tracking-widest"
                  >
                    <LogOut className="w-5 h-5" />
                    Sign Out
                  </button>
                </>
              ) : (
                <button 
                  onClick={() => {
                    signInWithGoogle();
                    setShowMobileMenu(false);
                  }}
                  className="flex items-center gap-3 text-lg font-medium text-gym-beige hover:text-white transition-colors uppercase tracking-widest"
                >
                  Sign In
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Admin Panel Overlay */}
      <AnimatePresence>
        {showAdminPanel && isAdmin && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 left-0 right-0 z-40 bg-zinc-900 border-b border-gym-beige/20 shadow-2xl max-h-[80vh] overflow-y-auto"
          >
            <div className="max-w-7xl mx-auto px-6 py-8">
              <div className="flex justify-between items-center mb-8">
                <h2 className="font-display text-3xl font-bold text-gym-beige">Admin Dashboard</h2>
                <button onClick={() => setShowAdminPanel(false)} className="text-gray-400 hover:text-white">Close</button>
              </div>

              <div className="grid lg:grid-cols-2 gap-12">
                {/* Manage Testimonials */}
                <div>
                  <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><Star className="w-5 h-5 text-gym-beige"/> Manage Testimonials</h3>
                  <div className="space-y-4 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                    {testimonials.map(t => (
                      <div key={t.id} className="bg-zinc-950 p-4 rounded-xl border border-gym-beige/10">
                        <div className="flex justify-between items-start mb-2">
                          <div className="font-bold">{t.name}</div>
                          <div className="flex gap-2">
                            {t.status === 'pending' && (
                              <button onClick={() => handleApproveTestimonial(t.id)} className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded hover:bg-green-500/30">Approve</button>
                            )}
                            <button onClick={() => handleDeleteTestimonial(t.id)} className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded hover:bg-red-500/30"><Trash2 className="w-3 h-3"/></button>
                          </div>
                        </div>
                        <p className="text-sm text-gray-400">"{t.text}"</p>
                        <div className="text-xs text-gray-500 mt-2">Status: {t.status}</div>
                      </div>
                    ))}
                    {testimonials.length === 0 && <p className="text-gray-500 text-sm">No testimonials yet.</p>}
                  </div>
                </div>

                {/* Manage Blogs */}
                <div>
                  <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><BookOpen className="w-5 h-5 text-gym-beige"/> Add New Blog</h3>
                  <form onSubmit={handleBlogSubmit} className="space-y-4 mb-8">
                    <input 
                      type="text" placeholder="Title" required value={newBlog.title} onChange={e => setNewBlog({...newBlog, title: e.target.value})}
                      className="w-full bg-zinc-950 border border-gym-beige/20 rounded-lg px-4 py-2 text-white focus:border-gym-beige outline-none"
                    />
                    <input 
                      type="text" placeholder="Short Excerpt" required value={newBlog.excerpt} onChange={e => setNewBlog({...newBlog, excerpt: e.target.value})}
                      className="w-full bg-zinc-950 border border-gym-beige/20 rounded-lg px-4 py-2 text-white focus:border-gym-beige outline-none"
                    />
                    <textarea 
                      placeholder="Full Content" required rows={4} value={newBlog.content} onChange={e => setNewBlog({...newBlog, content: e.target.value})}
                      className="w-full bg-zinc-950 border border-gym-beige/20 rounded-lg px-4 py-2 text-white focus:border-gym-beige outline-none resize-none"
                    />
                    <div className="flex items-center gap-4">
                      <label className="cursor-pointer bg-zinc-950 border border-gym-beige/20 px-4 py-2 rounded-lg hover:border-gym-beige transition-colors flex-grow text-center text-sm text-gray-400">
                        {blogImageFile ? blogImageFile.name : "Upload Featured Image (Optional)"}
                        <input type="file" accept="image/*" className="hidden" onChange={e => setBlogImageFile(e.target.files?.[0] || null)} />
                      </label>
                    </div>
                    <button type="submit" className="w-full bg-gym-beige text-gym-black px-4 py-2 rounded-lg font-bold hover:bg-white transition-colors">Publish Blog</button>
                  </form>

                  <h3 className="text-xl font-bold mb-4">Existing Blogs</h3>
                  <div className="space-y-4 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                    {blogs.map(b => (
                      <div key={b.id} className="bg-zinc-950 p-4 rounded-xl border border-gym-beige/10 flex justify-between items-center">
                        <div>
                          <div className="font-bold">{b.title}</div>
                          <div className="text-xs text-gray-500">{b.date}</div>
                        </div>
                        <button onClick={() => handleDeleteBlog(b.id)} className="text-red-400 hover:text-red-300 p-2"><Trash2 className="w-4 h-4"/></button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Blog Modal */}
      <AnimatePresence>
        {selectedBlog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-zinc-950 border border-gym-beige/20 rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-y-auto custom-scrollbar relative"
            >
              <button 
                onClick={() => setSelectedBlog(null)}
                className="absolute top-6 right-6 p-2 bg-black/50 hover:bg-black rounded-full text-white transition-colors z-10"
              >
                <X className="w-6 h-6" />
              </button>

              {selectedBlog.imageUrl && (
                <div className="w-full h-64 sm:h-96 relative">
                  <img src={selectedBlog.imageUrl} alt={selectedBlog.title} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 to-transparent" />
                </div>
              )}

              <div className="p-8 sm:p-12">
                <div className="flex items-center gap-4 text-gym-beige/60 text-sm mb-4">
                  <span className="flex items-center gap-2"><BookOpen className="w-4 h-4" /> {selectedBlog.date}</span>
                  <span>•</span>
                  <span>By {selectedBlog.authorName}</span>
                </div>
                
                <h2 className="font-display text-3xl sm:text-5xl font-bold text-white mb-8">{selectedBlog.title}</h2>
                
                <div className="prose prose-invert prose-lg max-w-none mb-12 text-gray-300 whitespace-pre-wrap">
                  {selectedBlog.content}
                </div>

                {/* Reactions & Comments Section */}
                <div className="border-t border-gym-beige/10 pt-8">
                  <div className="flex items-center gap-6 mb-8">
                    <button 
                      onClick={() => handleLikeBlog(selectedBlog.id, selectedBlog.likes)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-colors ${user && selectedBlog.likes?.includes(user.uid) ? 'bg-red-500/20 border-red-500 text-red-500' : 'border-gray-600 text-gray-400 hover:border-gym-beige hover:text-gym-beige'}`}
                    >
                      <Heart className={`w-5 h-5 ${user && selectedBlog.likes?.includes(user.uid) ? 'fill-current' : ''}`} />
                      <span className="font-bold">{selectedBlog.likes?.length || 0}</span>
                    </button>
                    <div className="flex items-center gap-2 text-gray-400">
                      <MessageSquare className="w-5 h-5" />
                      <span className="font-bold">{blogComments.length} Comments</span>
                    </div>
                  </div>

                  {/* Comments List */}
                  <div className="space-y-6 mb-8">
                    {blogComments.map(comment => (
                      <div key={comment.id} className="bg-zinc-900/50 p-4 rounded-2xl border border-gym-beige/5">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <span className="font-bold text-white">{comment.authorName}</span>
                            <span className="text-xs text-gray-500 ml-3">{new Date(comment.createdAt).toLocaleDateString()}</span>
                          </div>
                          {(isAdmin || (user && user.uid === comment.authorId)) && (
                            <button onClick={() => handleDeleteComment(comment.id)} className="text-red-400 hover:text-red-300 p-1">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        <p className="text-gray-300">{comment.text}</p>
                      </div>
                    ))}
                    {blogComments.length === 0 && (
                      <p className="text-gray-500 italic">No comments yet. Be the first to share your thoughts!</p>
                    )}
                  </div>

                  {/* Add Comment */}
                  <form onSubmit={handleAddComment} className="flex flex-col sm:flex-row gap-3 sm:gap-4 shrink-0">
                    <input 
                      type="text" 
                      placeholder={user ? "Write a comment..." : "Sign in to comment"}
                      value={newComment}
                      onChange={e => setNewComment(e.target.value)}
                      disabled={!user}
                      className="flex-grow min-w-0 bg-zinc-900 border border-gym-beige/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gym-beige transition-colors disabled:opacity-50"
                    />
                    <button 
                      type="submit"
                      disabled={!user || !newComment.trim()}
                      className="shrink-0 bg-gym-beige text-gym-black px-6 py-3 rounded-xl font-bold hover:bg-white transition-colors disabled:opacity-50"
                    >
                      Post
                    </button>
                  </form>
                  {/* Spacer to ensure bottom padding is respected in scrollable container */}
                  <div className="h-8 sm:h-12 w-full shrink-0"></div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero Section */}
      <section className="relative min-h-screen flex flex-col pt-32 pb-20 px-6 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=2070&auto=format&fit=crop" 
            alt="Gym interior" 
            className="w-full h-full object-cover opacity-30 mix-blend-luminosity scale-105 animate-[pulse_10s_ease-in-out_infinite]"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-gym-black/40 via-gym-black/80 to-gym-black" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(230,223,211,0.05)_0%,transparent_60%)]" />
        </div>

        {/* Massive Background Text */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full text-center z-0 pointer-events-none overflow-hidden select-none">
          <h1 className="font-display text-[15vw] font-bold uppercase leading-none text-stroke-thick opacity-20 whitespace-nowrap">
            4M-R FITNESS
          </h1>
        </div>

        <div className="max-w-7xl mx-auto w-full relative z-10 grid lg:grid-cols-12 gap-12 items-center my-auto">
          <motion.div 
            className="lg:col-span-7"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-panel text-gym-beige text-sm font-bold tracking-widest uppercase mb-8">
              <MapPin className="w-4 h-4" />
              Cabuyao City, Laguna
            </div>
            <h1 className="font-display text-6xl sm:text-7xl lg:text-8xl font-bold tracking-tighter uppercase leading-[0.9] mb-8 text-white">
              No Pain <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-gym-beige to-gym-beige-dark">No Gain.</span>
            </h1>
            <p className="text-lg sm:text-xl text-gray-400 mb-10 max-w-xl leading-relaxed font-light">
              Your dedicated local fitness destination in Marinig. Build strength, improve endurance, and reach your goals in a focused environment.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-6">
              <a 
                href={mapsLink}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative inline-flex items-center justify-center gap-2 bg-gym-beige text-gym-black px-8 py-4 rounded-full font-bold text-lg overflow-hidden transition-transform hover:scale-105 active:scale-95"
              >
                <div className="absolute inset-0 bg-white translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
                <span className="relative z-10">Visit Us</span>
                <ArrowUpRight className="w-5 h-5 relative z-10 group-hover:rotate-45 transition-transform duration-300" />
              </a>
              <a 
                href="#contact"
                className="inline-flex items-center justify-center gap-2 glass-panel text-white px-8 py-4 rounded-full font-bold text-lg hover:bg-white/10 transition-colors"
              >
                Contact Us
              </a>
            </div>
          </motion.div>

          <motion.div 
            className="lg:col-span-5 hidden lg:block"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
          >
            <div className="relative w-full aspect-[4/5] rounded-3xl overflow-hidden glass p-2">
              <img 
                src="https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?q=80&w=2070&auto=format&fit=crop" 
                alt="Gym Training" 
                className="w-full h-full object-cover rounded-2xl grayscale hover:grayscale-0 transition-all duration-700"
                referrerPolicy="no-referrer"
              />
              <div className="absolute bottom-6 left-6 right-6 glass-panel p-6 rounded-2xl">
                <div className="flex items-center gap-4 mb-2">
                  <div className="w-12 h-12 rounded-full bg-gym-beige flex items-center justify-center text-gym-black">
                    <Activity className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-white font-bold text-xl">Premium</div>
                    <div className="text-gym-beige/80 text-sm">Equipment & Coaching</div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* About Section */}
      <section className="py-32 px-6 bg-gym-black relative overflow-hidden">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-gym-beige/5 to-transparent pointer-events-none" />
        <div className="max-w-7xl mx-auto">
          <motion.div 
            className="grid lg:grid-cols-2 gap-16 items-center"
            {...fadeIn}
          >
            <div className="relative">
              <div className="absolute -inset-4 bg-gym-beige/10 blur-2xl rounded-full opacity-50" />
              <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold uppercase mb-8 relative z-10 leading-tight">
                Built for <br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-gym-beige to-gym-beige-dark">Real Results.</span>
              </h2>
              <div className="space-y-6 relative z-10">
                <p className="text-gray-400 text-lg leading-relaxed font-light">
                  Located right in the heart of St Joseph 7, Marinig, we are Cabuyao City's neighborhood gym built for real results. We believe in hard work, consistency, and providing our community with the right environment to train effectively.
                </p>
                <p className="text-gray-400 text-lg leading-relaxed font-light">
                  Whether you are stepping into a gym for the first time or you are an experienced lifter, our facility is open daily from <strong className="text-gym-beige font-medium">5:30 AM to 10 PM</strong> to fit your schedule.
                </p>
              </div>
              
              <div className="mt-12 grid grid-cols-2 gap-8 relative z-10">
                <div>
                  <div className="text-4xl font-display font-bold text-gym-beige mb-2">100%</div>
                  <div className="text-sm text-gray-500 uppercase tracking-wider">Commitment</div>
                </div>
                <div>
                  <div className="text-4xl font-display font-bold text-gym-beige mb-2">24/7</div>
                  <div className="text-sm text-gray-500 uppercase tracking-wider">Dedication</div>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="absolute -inset-4 bg-gym-beige/20 blur-3xl rounded-full opacity-30" />
              <div className="relative aspect-[4/5] rounded-3xl overflow-hidden glass p-2 transform rotate-2 hover:rotate-0 transition-transform duration-500">
                <img 
                  src="https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?q=80&w=2070&auto=format&fit=crop" 
                  alt="Gym equipment" 
                  className="w-full h-full object-cover rounded-2xl grayscale hover:grayscale-0 transition-all duration-700"
                  referrerPolicy="no-referrer"
                />
              </div>
              {/* Floating element */}
              <motion.div 
                className="absolute -bottom-8 -left-8 glass-panel p-6 rounded-2xl max-w-[200px]"
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              >
                <div className="flex items-center gap-3 mb-2">
                  <Star className="w-5 h-5 text-gym-beige fill-gym-beige" />
                  <span className="font-bold text-white">Top Rated</span>
                </div>
                <p className="text-xs text-gray-400">Voted best local gym in Marinig.</p>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-32 px-6 bg-gym-black-light relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(230,223,211,0.03)_0%,transparent_50%)]" />
        <div className="max-w-7xl mx-auto relative z-10">
          <motion.div className="text-center mb-20" {...fadeIn}>
            <h2 className="font-display text-4xl sm:text-6xl font-bold uppercase mb-6">What We Offer</h2>
            <p className="text-gray-400 max-w-2xl mx-auto text-lg font-light">Everything you need to put in the work and see the gains. No gimmicks, just solid equipment and expert guidance.</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            <motion.div 
              className="md:col-span-2 bg-gym-black border border-white/5 p-10 rounded-3xl group hover:border-gym-beige/30 transition-colors relative overflow-hidden"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-gym-beige/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-gym-beige/10 transition-colors" />
              <Dumbbell className="w-12 h-12 text-gym-beige mb-8 relative z-10" />
              <h3 className="text-3xl font-display font-bold mb-4 relative z-10">Strength Training</h3>
              <p className="text-gray-400 leading-relaxed max-w-md relative z-10 font-light text-lg">Free weights, benches, and resistance machines designed to build muscle and power effectively.</p>
            </motion.div>

            <motion.div 
              className="bg-gym-black border border-white/5 p-10 rounded-3xl group hover:border-gym-beige/30 transition-colors relative overflow-hidden"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <Activity className="w-12 h-12 text-gym-beige mb-8 relative z-10" />
              <h3 className="text-2xl font-display font-bold mb-4 relative z-10">Cardio</h3>
              <p className="text-gray-400 leading-relaxed relative z-10 font-light">Treadmills and cardio equipment to improve your stamina.</p>
            </motion.div>

            <motion.div 
              className="bg-gym-black border border-white/5 p-10 rounded-3xl group hover:border-gym-beige/30 transition-colors relative overflow-hidden"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <Users className="w-12 h-12 text-gym-beige mb-8 relative z-10" />
              <h3 className="text-2xl font-display font-bold mb-4 relative z-10">Open Gym</h3>
              <p className="text-gray-400 leading-relaxed relative z-10 font-light">Train at your own pace in a focused, no-nonsense environment.</p>
            </motion.div>

            <motion.div 
              className="md:col-span-2 bg-gym-beige text-gym-black p-10 rounded-3xl group relative overflow-hidden"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?q=80&w=2070&auto=format&fit=crop')] opacity-10 mix-blend-multiply bg-cover bg-center group-hover:scale-105 transition-transform duration-700" />
              <Target className="w-12 h-12 mb-8 relative z-10" />
              <h3 className="text-3xl font-display font-bold mb-4 relative z-10">Free Coaching</h3>
              <p className="text-gym-black/80 leading-relaxed max-w-md relative z-10 font-medium text-lg">Get expert guidance and form correction at no extra cost to maximize your results and prevent injuries.</p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-32 px-6 bg-gym-black relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,rgba(230,223,211,0.05)_0%,transparent_70%)]" />
        <div className="max-w-7xl mx-auto relative z-10">
          <motion.div className="text-center mb-20" {...fadeIn}>
            <h2 className="font-display text-4xl sm:text-6xl font-bold uppercase mb-6">Membership Plans</h2>
            <p className="text-gray-400 max-w-2xl mx-auto text-lg font-light">Straightforward pricing. No hidden fees. Just results.</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Daily */}
            <motion.div 
              className="bg-gym-black border border-white/5 p-10 rounded-3xl flex flex-col hover:border-gym-beige/30 transition-colors relative group"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <div className="absolute inset-0 bg-gradient-to-b from-gym-beige/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-3xl" />
              <h3 className="text-2xl font-bold mb-2 relative z-10">Daily Pass</h3>
              <div className="text-5xl font-display font-bold text-gym-beige mb-8 relative z-10">₱50</div>
              <ul className="space-y-4 mb-10 text-gray-400 flex-grow relative z-10 font-light">
                <li className="flex items-center gap-3"><Check className="w-5 h-5 text-gym-beige shrink-0"/> Full gym access</li>
                <li className="flex items-center gap-3"><Check className="w-5 h-5 text-gym-beige shrink-0"/> Valid for one day</li>
                <li className="flex items-center gap-3"><Check className="w-5 h-5 text-gym-beige shrink-0"/> Free coaching</li>
              </ul>
              <a href="#contact" className="block text-center w-full py-4 rounded-full border border-gym-beige/30 text-gym-beige hover:bg-gym-beige hover:text-gym-black transition-colors font-bold uppercase tracking-wider relative z-10">Inquire Now</a>
            </motion.div>

            {/* Monthly (Featured) */}
            <motion.div 
              className="bg-gym-beige text-gym-black p-10 rounded-3xl flex flex-col relative transform md:-translate-y-8 shadow-[0_0_40px_rgba(230,223,211,0.15)]"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gym-black text-gym-beige px-6 py-2 rounded-full text-sm font-bold uppercase tracking-widest border border-gym-beige/20">Best Value</div>
              <h3 className="text-2xl font-bold mb-2">Monthly</h3>
              <div className="text-6xl font-display font-bold mb-8">₱500</div>
              <ul className="space-y-4 mb-10 text-gym-black/80 flex-grow font-medium">
                <li className="flex items-center gap-3"><Check className="w-5 h-5 shrink-0"/> Full gym access</li>
                <li className="flex items-center gap-3"><Check className="w-5 h-5 shrink-0"/> 30 days validity</li>
                <li className="flex items-center gap-3"><Check className="w-5 h-5 shrink-0"/> Free coaching</li>
                <li className="flex items-center gap-3"><Check className="w-5 h-5 shrink-0"/> Best cost per day</li>
              </ul>
              <a href="#contact" className="block text-center w-full py-4 rounded-full bg-gym-black text-gym-beige hover:bg-zinc-800 transition-colors font-bold uppercase tracking-wider shadow-lg hover:shadow-xl">Join Now</a>
            </motion.div>

            {/* Half Month */}
            <motion.div 
              className="bg-gym-black border border-white/5 p-10 rounded-3xl flex flex-col hover:border-gym-beige/30 transition-colors relative group"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <div className="absolute inset-0 bg-gradient-to-b from-gym-beige/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-3xl" />
              <h3 className="text-2xl font-bold mb-2 relative z-10">Half Month</h3>
              <div className="text-5xl font-display font-bold text-gym-beige mb-8 relative z-10">₱250</div>
              <ul className="space-y-4 mb-10 text-gray-400 flex-grow relative z-10 font-light">
                <li className="flex items-center gap-3"><Check className="w-5 h-5 text-gym-beige shrink-0"/> Full gym access</li>
                <li className="flex items-center gap-3"><Check className="w-5 h-5 text-gym-beige shrink-0"/> 15 days validity</li>
                <li className="flex items-center gap-3"><Check className="w-5 h-5 text-gym-beige shrink-0"/> Free coaching</li>
              </ul>
              <a href="#contact" className="block text-center w-full py-4 rounded-full border border-gym-beige/30 text-gym-beige hover:bg-gym-beige hover:text-gym-black transition-colors font-bold uppercase tracking-wider relative z-10">Inquire Now</a>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Daily Gallery */}
      <section className="py-32 px-6 bg-gym-black-light relative">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-8">
            <motion.div {...fadeIn} className="max-w-2xl">
              <h2 className="font-display text-4xl sm:text-6xl font-bold uppercase mb-6">Daily Gallery</h2>
              <p className="text-gray-400 text-lg font-light">See the grind. Share your progress with the 4M- R Fitness community.</p>
            </motion.div>
            <motion.div {...fadeIn}>
              <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                ref={fileInputRef}
                onChange={handleImageUpload}
              />
              <button 
                onClick={() => user ? fileInputRef.current?.click() : signInWithGoogle()}
                className="group relative inline-flex items-center gap-3 bg-gym-beige text-gym-black px-8 py-4 rounded-full font-bold uppercase tracking-wider overflow-hidden transition-transform hover:scale-105 active:scale-95"
              >
                <div className="absolute inset-0 bg-white translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
                <Camera className="w-5 h-5 relative z-10" />
                <span className="relative z-10">{user ? "Upload Photo" : "Sign in to Upload"}</span>
              </button>
            </motion.div>
          </div>
          
          {gallery.length === 0 ? (
            <div className="text-center py-20 border border-white/5 bg-white/5 rounded-3xl text-gray-500 font-light text-lg">
              No photos yet. Be the first to upload!
            </div>
          ) : (
            <div className="columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4">
              {gallery.map((img, idx) => (
                <motion.div 
                  key={img.id}
                  className="break-inside-avoid rounded-2xl overflow-hidden bg-zinc-900 relative group"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: (idx % 4) * 0.1 }}
                >
                  <img src={img.imageUrl} alt={`Gallery image`} className="w-full h-auto object-cover grayscale group-hover:grayscale-0 group-hover:scale-105 transition-all duration-700" />
                  
                  {/* Delete button (visible on hover if owner or admin) */}
                  {(isAdmin || (user && user.uid === img.uploaderId)) && (
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center backdrop-blur-sm">
                      <button 
                        onClick={() => handleDeleteImage(img.id)}
                        className="bg-red-500 text-white p-4 rounded-full hover:bg-red-600 hover:scale-110 transition-all shadow-xl"
                        title="Delete Image"
                      >
                        <Trash2 className="w-6 h-6" />
                      </button>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Blogs & Updates */}
      <section className="py-32 px-6 bg-gym-black relative">
        <div className="max-w-7xl mx-auto">
          <motion.div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-8" {...fadeIn}>
            <div className="max-w-2xl">
              <h2 className="font-display text-4xl sm:text-6xl font-bold uppercase mb-6">Gym Updates</h2>
              <p className="text-gray-400 text-lg font-light">Latest news, fitness tips, and announcements from our team.</p>
            </div>
          </motion.div>
          
          {blogs.length === 0 ? (
             <div className="text-center py-20 border border-white/5 bg-white/5 rounded-3xl text-gray-500 font-light text-lg">
               No updates yet. Check back soon!
             </div>
          ) : (
            <div className="grid md:grid-cols-3 gap-8">
              {blogs.map((blog, idx) => (
                <motion.div 
                  key={blog.id}
                  className="bg-gym-black border border-white/5 rounded-3xl hover:border-gym-beige/30 transition-all duration-500 group overflow-hidden flex flex-col"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: idx * 0.1 }}
                >
                  {blog.imageUrl && (
                    <div className="w-full h-64 overflow-hidden relative">
                      <div className="absolute inset-0 bg-gym-black/20 group-hover:bg-transparent transition-colors z-10" />
                      <img src={blog.imageUrl} alt={blog.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                    </div>
                  )}
                  <div className="p-8 flex flex-col flex-grow relative">
                    <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-gym-beige/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="text-gym-beige/60 text-sm mb-4 flex items-center justify-between font-medium tracking-wide">
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-4 h-4" /> {blog.date}
                      </div>
                      <div className="flex items-center gap-1">
                        <Heart className="w-4 h-4" /> {blog.likes?.length || 0}
                      </div>
                    </div>
                    <h3 className="text-2xl font-display font-bold mb-3 group-hover:text-gym-beige transition-colors">{blog.title}</h3>
                    <div className="text-sm text-gray-500 mb-4 font-medium uppercase tracking-wider">By {blog.authorName}</div>
                    <p className="text-gray-400 leading-relaxed mb-8 flex-grow font-light">{blog.excerpt}</p>
                    <button 
                      onClick={() => setSelectedBlog(blog)}
                      className="text-gym-beige font-bold inline-flex items-center gap-2 hover:gap-4 transition-all uppercase tracking-wider mt-auto"
                    >
                      Read More <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Testimonials Carousel */}
      <section className="py-32 px-6 bg-gym-beige text-gym-black overflow-hidden relative">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=2070&auto=format&fit=crop')] opacity-5 mix-blend-multiply bg-cover bg-center" />
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div {...fadeIn} className="flex flex-col justify-center">
              <h2 className="font-display text-5xl sm:text-7xl font-bold uppercase mb-6 leading-none tracking-tighter">Community <br/> Voice</h2>
              <p className="text-gym-black/70 mb-12 text-xl font-medium">See what our members are saying, or share your own experience.</p>
              
              {approvedTestimonials.length > 0 ? (
                <div className="relative">
                  <div className="overflow-hidden rounded-3xl">
                    <AnimatePresence mode="wait">
                      <motion.div 
                        key={currentTestimonialIdx}
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -50 }}
                        transition={{ duration: 0.4, ease: "easeInOut" }}
                        className="bg-white/60 backdrop-blur-md p-10 sm:p-12 border border-white/40 shadow-xl"
                      >
                        <div className="flex gap-1 mb-8">
                          {[...Array(approvedTestimonials[currentTestimonialIdx].rating)].map((_, i) => <Star key={i} className="w-6 h-6 fill-gym-black text-gym-black" />)}
                        </div>
                        <p className="text-2xl sm:text-3xl font-medium mb-10 leading-relaxed font-display">"{approvedTestimonials[currentTestimonialIdx].text}"</p>
                        <div className="flex items-center gap-4">
                          {approvedTestimonials[currentTestimonialIdx].imageUrl ? (
                            <img 
                              src={approvedTestimonials[currentTestimonialIdx].imageUrl} 
                              alt={approvedTestimonials[currentTestimonialIdx].name} 
                              className="w-12 h-12 rounded-full object-cover border-2 border-gym-black shrink-0"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-gym-black flex items-center justify-center shrink-0">
                              <User className="w-6 h-6 text-gym-beige" />
                            </div>
                          )}
                          <div className="font-bold uppercase tracking-widest text-sm flex items-center gap-4">
                            <div className="w-10 h-px bg-gym-black" />
                            {approvedTestimonials[currentTestimonialIdx].name}
                          </div>
                        </div>
                      </motion.div>
                    </AnimatePresence>
                  </div>
                  
                  {/* Carousel Controls */}
                  {approvedTestimonials.length > 1 && (
                    <div className="flex gap-4 mt-8">
                      <button onClick={prevTestimonial} className="w-14 h-14 rounded-full border-2 border-gym-black flex items-center justify-center hover:bg-gym-black hover:text-gym-beige transition-all hover:scale-105 active:scale-95">
                        <ChevronLeft className="w-6 h-6" />
                      </button>
                      <button onClick={nextTestimonial} className="w-14 h-14 rounded-full border-2 border-gym-black flex items-center justify-center hover:bg-gym-black hover:text-gym-beige transition-all hover:scale-105 active:scale-95">
                        <ChevronRight className="w-6 h-6" />
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white/40 backdrop-blur-sm p-10 rounded-3xl border border-white/20 text-center shadow-lg">
                  <p className="text-xl font-medium">No reviews yet. Be the first to share your experience!</p>
                </div>
              )}
            </motion.div>

            <motion.div 
              className="bg-gym-black text-gym-beige p-10 sm:p-12 rounded-3xl h-fit shadow-2xl relative overflow-hidden"
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-gym-beige/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
              <h3 className="font-display text-3xl font-bold uppercase mb-8 relative z-10">Add Your Review</h3>
              <form onSubmit={handleTestimonialSubmit} className="space-y-6 relative z-10">
                <div>
                  <label className="block text-sm font-bold uppercase tracking-wider mb-3 text-gray-400">Your Name</label>
                  <input 
                    type="text" 
                    required
                    value={newTestimonial.name}
                    onChange={e => setNewTestimonial({...newTestimonial, name: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-white focus:outline-none focus:border-gym-beige transition-colors"
                    placeholder="John D."
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold uppercase tracking-wider mb-3 text-gray-400">Your Experience</label>
                  <textarea 
                    required
                    rows={4}
                    value={newTestimonial.text}
                    onChange={e => setNewTestimonial({...newTestimonial, text: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-white focus:outline-none focus:border-gym-beige transition-colors resize-none"
                    placeholder="Tell us about your progress..."
                  />
                </div>
                <div>
                  <label className="cursor-pointer flex items-center justify-center gap-2 w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-gray-400 hover:text-gym-beige hover:border-gym-beige transition-colors text-sm font-bold uppercase tracking-wider">
                    <Camera className="w-5 h-5" />
                    {testimonialImageFile ? testimonialImageFile.name : "Upload Profile Photo (Optional)"}
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={e => setTestimonialImageFile(e.target.files?.[0] || null)} 
                    />
                  </label>
                </div>
                <button 
                  type="submit"
                  className="w-full bg-gym-beige text-gym-black font-bold uppercase tracking-wider py-4 rounded-xl hover:bg-white transition-all hover:shadow-[0_0_20px_rgba(230,223,211,0.3)] mt-4"
                >
                  {user ? "Submit Testimonial" : "Sign in to Submit"}
                </button>
              </form>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="py-32 px-6 bg-gym-black-light text-gym-beige relative overflow-hidden">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gym-black/50 skew-x-12 translate-x-32" />
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div {...fadeIn}>
              <h2 className="font-display text-5xl sm:text-7xl font-bold uppercase mb-10 leading-none tracking-tighter">
                Built for the <br/><span className="text-stroke-thick text-transparent">Local Community</span>
              </h2>
              <div className="space-y-10">
                <div className="flex gap-6 group">
                  <div className="w-16 h-16 rounded-2xl bg-gym-beige text-gym-black flex items-center justify-center shrink-0 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300 shadow-lg">
                    <Clock className="w-8 h-8" />
                  </div>
                  <div>
                    <h4 className="text-2xl font-bold mb-3 font-display">Extended Daily Hours</h4>
                    <p className="text-gray-400 text-lg font-light leading-relaxed">Open Monday to Sunday from 5:30 AM to 10:00 PM. Train before work, after work, or on weekends.</p>
                  </div>
                </div>
                <div className="flex gap-6 group">
                  <div className="w-16 h-16 rounded-2xl bg-gym-beige text-gym-black flex items-center justify-center shrink-0 group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-300 shadow-lg">
                    <MapPin className="w-8 h-8" />
                  </div>
                  <div>
                    <h4 className="text-2xl font-bold mb-3 font-display">Convenient Location</h4>
                    <p className="text-gray-400 text-lg font-light leading-relaxed">Easily accessible in St Joseph 7, Marinig, Cabuyao City. Your neighborhood fitness hub.</p>
                  </div>
                </div>
              </div>
            </motion.div>
            <motion.div 
              className="relative"
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <div className="absolute inset-0 bg-gym-beige/10 rounded-3xl translate-x-4 translate-y-4 -z-10" />
              <img 
                src="https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?q=80&w=2070&auto=format&fit=crop" 
                alt="Gym weights" 
                className="rounded-3xl shadow-2xl grayscale hover:grayscale-0 transition-all duration-700"
                referrerPolicy="no-referrer"
              />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Contact & Location */}
      <section id="contact" className="py-32 px-6 bg-gym-black relative">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            className="bg-zinc-900/80 backdrop-blur-xl rounded-[2rem] sm:rounded-[3rem] p-6 sm:p-16 border border-white/10 shadow-2xl relative overflow-hidden"
            {...fadeIn}
          >
            <div className="absolute top-0 right-0 w-96 h-96 bg-gym-beige/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="grid lg:grid-cols-2 gap-16 relative z-10">
              <div>
                <h2 className="font-display text-4xl sm:text-6xl font-bold uppercase mb-6">Ready to start?</h2>
                <p className="text-gray-400 mb-12 text-xl font-light">Drop by the gym or reach out to us for membership inquiries.</p>
                
                <div className="space-y-8 w-full overflow-hidden">
                  <a href={`tel:${phoneNumber}`} className="flex items-center gap-4 sm:gap-6 group w-full">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 shrink-0 rounded-full bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-gym-beige group-hover:text-gym-black group-hover:scale-110 transition-all duration-300">
                      <Phone className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs sm:text-sm text-gray-500 uppercase tracking-wider font-bold mb-1">Call Us</div>
                      <div className="font-medium text-lg sm:text-2xl group-hover:text-gym-beige transition-colors truncate">{phoneNumber}</div>
                    </div>
                  </a>
                  
                  <a href={`mailto:${email}`} className="flex items-center gap-4 sm:gap-6 group w-full">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0 group-hover:bg-gym-beige group-hover:text-gym-black group-hover:scale-110 transition-all duration-300">
                      <Mail className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs sm:text-sm text-gray-500 uppercase tracking-wider font-bold mb-1">Email Us</div>
                      <div className="font-medium text-base sm:text-xl group-hover:text-gym-beige transition-colors break-all">{email}</div>
                    </div>
                  </a>

                  <div className="flex items-center gap-4 sm:gap-6 w-full">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 shrink-0 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                      <Clock className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs sm:text-sm text-gray-500 uppercase tracking-wider font-bold mb-1">Opening Hours</div>
                      <div className="font-medium text-base sm:text-xl whitespace-normal">Mon - Sun: 5:30 AM – 10:00 PM</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col">
                <div className="bg-gym-black p-6 sm:p-10 rounded-[2rem] sm:rounded-3xl border border-white/5 flex-grow flex flex-col justify-between shadow-inner">
                  <div>
                    <div className="flex items-start gap-4 mb-6">
                      <MapPin className="w-6 h-6 sm:w-8 sm:h-8 text-gym-beige shrink-0 mt-1" />
                      <div>
                        <h4 className="font-bold text-xl sm:text-2xl mb-2 sm:mb-3 font-display">Location</h4>
                        <p className="text-gray-400 leading-relaxed text-base sm:text-lg font-light">
                          {address}
                        </p>
                      </div>
                    </div>
                  </div>
                  <a 
                    href={mapsLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-8 sm:mt-10 w-full flex items-center justify-center gap-2 sm:gap-3 bg-gym-beige text-gym-black px-6 sm:px-8 py-4 sm:py-5 rounded-full font-bold text-sm sm:text-base uppercase tracking-wider hover:bg-white hover:scale-105 transition-all duration-300 shadow-lg"
                  >
                    Get Directions
                    <ChevronRight className="w-6 h-6" />
                  </a>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-white/10 bg-gym-black text-center sm:text-left relative z-10">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-6">
          <div className="font-display font-bold text-xl tracking-tighter text-gym-beige">
            4M- R FITNESS
          </div>
          <div className="text-gray-500 text-sm">
            © {new Date().getFullYear()} 4M- R Fitness Gym. Cabuyao City, Laguna.
          </div>
        </div>
      </footer>
    </div>
  );
}
