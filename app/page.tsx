"use client"

import type React from "react"
import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  BookOpen,
  Brain,
  Users,
  BarChart3,
  Settings,
  Edit,
  Trash2,
  Plus,
  Copy,
  Download,
  User,
  Sparkles,
  TrendingUp,
  FileText,
  X,
} from "lucide-react"
import { aiService } from "@/lib/ai-service"

interface Question {
  id: string
  originalQuestion: string
  generatedVariations: string[]
  subject: string
  difficulty: "Easy" | "Medium" | "Hard"
  category: string
  tags: string[]
  createdAt: Date
  isActive: boolean
}

interface Assignment {
  id: string
  title: string
  description: string
  questionIds: string[]
  dueDate: Date
  isActive: boolean
  createdAt: Date
}

interface StudentSubmission {
  id: string
  questionId: string
  assignmentId?: string
  studentName: string
  answer: string
  submittedAt: Date
  aiScore?: number
  feedback?: string
  strengths?: string[]
  improvements?: string[]
  teacherReview?: string
}

interface Student {
  id: string
  name: string
  email?: string
  createdAt: Date
}

interface QuestionAllocation {
  id: string
  questionId: string
  studentId: string
  assignedAt: Date
  dueDate?: Date
  isCompleted: boolean
}

export default function AILabSystem() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [submissions, setSubmissions] = useState<StudentSubmission[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([])
  const [showAllocationDialog, setShowAllocationDialog] = useState(false)
  const [onAllocate, setOnAllocate] = useState<(questionId: string, studentIds: string[]) => void>(() => {})

  const [students, setStudents] = useState<Student[]>([
    { id: "1", name: "Alice Johnson", email: "alice@example.com", createdAt: new Date() },
    { id: "2", name: "Bob Smith", email: "bob@example.com", createdAt: new Date() },
    { id: "3", name: "Carol Davis", email: "carol@example.com", createdAt: new Date() },
  ])
  const [allocations, setAllocations] = useState<QuestionAllocation[]>([])
  const [newStudentName, setNewStudentName] = useState("")

  const addStudent = () => {
    if (newStudentName.trim()) {
      const newStudent: Student = {
        id: Date.now().toString(),
        name: newStudentName.trim(),
        createdAt: new Date(),
      }
      setStudents([...students, newStudent])
      setNewStudentName("")
    }
  }

  const removeStudent = (studentId: string) => {
    setStudents(students.filter((s) => s.id !== studentId))
    setAllocations(allocations.filter((a) => a.studentId !== studentId))
  }

  const allocateQuestion = (questionId: string, studentIds: string[]) => {
    const newAllocations = studentIds.map((studentId) => ({
      id: `${questionId}-${studentId}-${Date.now()}`,
      questionId,
      studentId,
      assignedAt: new Date(),
      isCompleted: false,
    }))
    setAllocations([...allocations, ...newAllocations])
  }

  const removeAllocation = (allocationId: string) => {
    setAllocations(allocations.filter((a) => a.id !== allocationId))
  }

  const getAllocatedQuestionsForStudent = useCallback(
    (studentName: string) => {
      const student = students.find((s) => s.name.toLowerCase() === studentName.toLowerCase())
      if (!student) return []

      const studentAllocations = allocations.filter((a) => a.studentId === student.id)
      return questions.filter((q) => studentAllocations.some((a) => a.questionId === q.id))
    },
    [students, allocations, questions],
  )

  const generateQuestions = async (
    originalQuestion: string,
    subject: string,
    difficulty: string,
    category: string,
    tags: string[],
    bulkCount?: number,
    autoAllocate?: boolean,
  ) => {
    setIsGenerating(true)

    try {
      if (bulkCount && bulkCount > 1) {
        // Generate multiple unique questions for bulk allocation
        const allVariations: string[] = []
        const batchSize = Math.min(4, bulkCount) // Generate in batches
        const batches = Math.ceil(bulkCount / batchSize)

        for (let i = 0; i < batches; i++) {
          const response = await aiService.generateQuestionVariations({
            originalQuestion,
            subject,
            difficulty,
            category,
            tags,
            variationCount: Math.min(batchSize, bulkCount - allVariations.length),
          })
          allVariations.push(...response.variations)
        }

        // Create individual questions for each variation
        const newQuestions: Question[] = allVariations.slice(0, bulkCount).map((variation, index) => ({
          id: `${Date.now()}-${index}`,
          originalQuestion,
          generatedVariations: [variation], // Each question has one unique variation
          subject,
          difficulty: difficulty as "Easy" | "Medium" | "Hard",
          category,
          tags,
          createdAt: new Date(),
          isActive: true,
        }))

        setQuestions((prev) => [...newQuestions, ...prev])

        // Auto-allocate if requested
        if (autoAllocate && students.length > 0) {
          const availableStudents = students.slice(0, bulkCount)
          const newAllocations: QuestionAllocation[] = []

          newQuestions.forEach((question, index) => {
            if (availableStudents[index]) {
              newAllocations.push({
                id: `${question.id}-${availableStudents[index].id}-${Date.now()}`,
                questionId: question.id,
                studentId: availableStudents[index].id,
                assignedAt: new Date(),
                isCompleted: false,
              })
            }
          })

          setAllocations((prev) => [...prev, ...newAllocations])
          alert(
            `Successfully generated ${newQuestions.length} questions and allocated them to ${newAllocations.length} students!`,
          )
        } else {
          alert(`Successfully generated ${newQuestions.length} unique questions!`)
        }
      } else {
        // Original single question generation logic
        const response = await aiService.generateQuestionVariations({
          originalQuestion,
          subject,
          difficulty,
          category,
          tags,
          variationCount: 4,
        })

        const newQuestion: Question = {
          id: Date.now().toString(),
          originalQuestion,
          generatedVariations: response.variations,
          subject,
          difficulty: difficulty as "Easy" | "Medium" | "Hard",
          category,
          tags,
          createdAt: new Date(),
          isActive: true,
        }

        setQuestions((prev) => [newQuestion, ...prev])
      }
    } catch (error) {
      console.error("Error generating questions:", error)
      alert("Error generating questions. Please try again.")
    } finally {
      setIsGenerating(false)
    }
  }

  const deleteQuestion = (questionId: string) => {
    setQuestions((prev) => prev.filter((q) => q.id !== questionId))
  }

  const toggleQuestionStatus = (questionId: string) => {
    setQuestions((prev) => prev.map((q) => (q.id === questionId ? { ...q, isActive: !q.isActive } : q)))
  }

  const createAssignment = (title: string, description: string, questionIds: string[], dueDate: Date) => {
    const newAssignment: Assignment = {
      id: Date.now().toString(),
      title,
      description,
      questionIds,
      dueDate,
      isActive: true,
      createdAt: new Date(),
    }
    setAssignments((prev) => [newAssignment, ...prev])
  }

  const submitAnswer = async (
    questionId: string,
    studentName: string,
    answer: string,
    assignmentId?: string,
  ): Promise<StudentSubmission> => {
    const question = questions.find((q) => q.id === questionId)
    if (!question) throw new Error("Question not found")

    try {
      const evaluation = await aiService.evaluateAnswer({
        question: question.originalQuestion,
        studentAnswer: answer,
        subject: question.subject,
      })

      const submission: StudentSubmission = {
        id: Date.now().toString(),
        questionId,
        assignmentId,
        studentName,
        answer,
        submittedAt: new Date(),
        aiScore: evaluation.score,
        feedback: evaluation.feedback,
        strengths: evaluation.strengths,
        improvements: evaluation.improvements,
        teacherReview: evaluation.teacherReview,
      }

      setSubmissions((prev) => [submission, ...prev])
      return submission
    } catch (error) {
      console.error("Error evaluating answer:", error)
      // Fallback to basic submission without AI evaluation
      const submission: StudentSubmission = {
        id: Date.now().toString(),
        questionId,
        assignmentId,
        studentName,
        answer,
        submittedAt: new Date(),
        aiScore: 75, // Default score if AI fails
        feedback:
          "Answer submitted successfully. AI evaluation temporarily unavailable - manual review may be required.",
        strengths: ["Answer submitted completely"],
        improvements: ["AI feedback unavailable - please check with instructor"],
        teacherReview: "AI evaluation unavailable",
      }

      setSubmissions((prev) => [submission, ...prev])
      return submission
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-violet-50 relative overflow-hidden particle-bg continuous-bg-orbs">
      <div className="continuous-gradient-waves"></div>
      <div className="continuous-particles"></div>
      <div className="continuous-aurora"></div>

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-purple-400/20 to-violet-600/20 rounded-full blur-3xl animate-float animate-morphing-gradient"></div>
        <div
          className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-tr from-indigo-400/20 to-purple-600/20 rounded-full blur-3xl animate-float animate-morphing-gradient"
          style={{ animationDelay: "2s" }}
        ></div>
        <div
          className="absolute top-1/2 left-1/2 w-64 h-64 bg-gradient-to-r from-violet-400/10 to-purple-600/10 rounded-full blur-2xl animate-particle-float"
          style={{ animationDelay: "4s" }}
        ></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 py-8">
        <div className="text-center mb-12 animate-bounce-in">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="relative hover-lift">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-violet-600 rounded-2xl blur-lg opacity-75 animate-glow-pulse"></div>
              <div className="relative bg-gradient-to-r from-purple-600 to-violet-600 p-3 rounded-2xl ripple-effect">
                <Brain className="h-10 w-10 text-white" />
              </div>
            </div>
            <div>
              <h1 className="text-5xl font-bold gradient-text-animated">AI Lab Question System</h1>
              <div className="h-1 w-32 bg-gradient-to-r from-purple-600 to-violet-600 rounded-full mx-auto mt-2 animate-text-shimmer"></div>
            </div>
          </div>
          <p
            className="text-xl text-gray-600 font-medium max-w-2xl mx-auto animate-slide-up"
            style={{ animationDelay: "0.2s" }}
          >
            Generate unique, equivalent lab questions with AI-powered variations and intelligent evaluation
          </p>
        </div>

        <Tabs defaultValue="teacher" className="w-full">
          <div className="flex justify-center mb-8 animate-slide-up" style={{ animationDelay: "0.4s" }}>
            <TabsList className="glass-morphism p-2 rounded-2xl shadow-xl border-0 hover-lift">
              <TabsTrigger
                value="teacher"
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all duration-500 hover-glow ripple-effect data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-violet-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:animate-glow-pulse"
              >
                <Settings className="h-5 w-5" />
                Teacher Portal
              </TabsTrigger>
              <TabsTrigger
                value="students"
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all duration-500 hover-glow ripple-effect data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-violet-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:animate-glow-pulse"
              >
                <Users className="h-5 w-5" />
                Students
              </TabsTrigger>
              <TabsTrigger
                value="assignments"
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all duration-500 hover-glow ripple-effect data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-violet-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:animate-glow-pulse"
              >
                <BookOpen className="h-5 w-5" />
                Assignments
              </TabsTrigger>
              <TabsTrigger
                value="student"
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all duration-500 hover-glow ripple-effect data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-violet-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:animate-glow-pulse"
              >
                <User className="h-5 w-5" />
                Student Portal
              </TabsTrigger>
              <TabsTrigger
                value="submissions"
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all duration-500 hover-glow ripple-effect data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-violet-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:animate-glow-pulse"
              >
                <FileText className="h-5 w-5" />
                Submissions
              </TabsTrigger>
              <TabsTrigger
                value="analytics"
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all duration-500 hover-glow ripple-effect data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-violet-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:animate-glow-pulse"
              >
                <BarChart3 className="h-5 w-5" />
                Analytics
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="teacher" className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 animate-slide-in-left">
                <Card className="glass-morphism border-0 shadow-2xl hover-lift hover-glow animate-card-flip">
                  <CardHeader className="bg-gradient-to-r from-purple-600/10 to-violet-600/10 rounded-t-xl">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gradient-to-r from-purple-600 to-violet-600 rounded-lg animate-glow-pulse ripple-effect">
                        <Sparkles className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-2xl font-bold text-gray-800 gradient-text-animated">
                          Generate Question Variations
                        </CardTitle>
                        <CardDescription className="text-gray-600 font-medium">
                          Create multiple unique but equivalent versions of your lab question
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-8">
                    <QuestionGeneratorForm
                      onGenerate={generateQuestions}
                      isGenerating={isGenerating}
                      students={students}
                    />
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-6 animate-slide-in-right">
                <Card className="glass-morphism border-0 shadow-xl hover-lift particle-bg">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-xl font-bold text-gray-800 flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-purple-600 animate-bounce" />
                      Quick Stats
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between items-center p-3 bg-gradient-to-r from-purple-50 to-violet-50 rounded-xl hover-lift animate-morphing-gradient">
                      <span className="text-sm font-semibold text-gray-700">Total Questions</span>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-purple-600 rounded-full animate-glow-pulse"></div>
                        <span className="font-bold text-lg text-purple-700 animate-bounce-in">{questions.length}</span>
                      </div>
                    </div>
                    <div
                      className="flex justify-between items-center p-3 bg-gradient-to-r from-violet-50 to-indigo-50 rounded-xl hover-lift animate-morphing-gradient"
                      style={{ animationDelay: "1s" }}
                    >
                      <span className="text-sm font-semibold text-gray-700">Active Questions</span>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 bg-violet-600 rounded-full animate-glow-pulse"
                          style={{ animationDelay: "0.5s" }}
                        ></div>
                        <span
                          className="font-bold text-lg text-violet-700 animate-bounce-in"
                          style={{ animationDelay: "0.1s" }}
                        >
                          {questions.filter((q) => q.isActive).length}
                        </span>
                      </div>
                    </div>
                    <div
                      className="flex justify-between items-center p-3 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl hover-lift animate-morphing-gradient"
                      style={{ animationDelay: "2s" }}
                    >
                      <span className="text-sm font-semibold text-gray-700">Assignments</span>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 bg-indigo-600 rounded-full animate-glow-pulse"
                          style={{ animationDelay: "1s" }}
                        ></div>
                        <span
                          className="font-bold text-lg text-indigo-700 animate-bounce-in"
                          style={{ animationDelay: "0.2s" }}
                        >
                          {assignments.length}
                        </span>
                      </div>
                    </div>
                    <div
                      className="flex justify-between items-center p-3 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl hover-lift animate-morphing-gradient"
                      style={{ animationDelay: "3s" }}
                    >
                      <span className="text-sm font-semibold text-gray-700">Submissions</span>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 bg-blue-600 rounded-full animate-glow-pulse"
                          style={{ animationDelay: "1.5s" }}
                        ></div>
                        <span
                          className="font-bold text-lg text-blue-700 animate-bounce-in"
                          style={{ animationDelay: "0.3s" }}
                        >
                          {submissions.length}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Bulk Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Button variant="outline" size="sm" className="w-full bg-transparent">
                      <Download className="h-4 w-4 mr-2" />
                      Export Questions
                    </Button>
                    <Button variant="outline" size="sm" className="w-full bg-transparent">
                      <Copy className="h-4 w-4 mr-2" />
                      Duplicate Selected
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Question Management */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Question Library</CardTitle>
                    <CardDescription>Manage your generated questions and variations</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Select defaultValue="all">
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <QuestionLibrary
                  questions={questions}
                  onDelete={deleteQuestion}
                  onToggleStatus={toggleQuestionStatus}
                  selectedQuestions={selectedQuestions}
                  onSelectionChange={setSelectedQuestions}
                  students={students}
                  onAllocate={allocateQuestion}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="students" className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold">Student Management</h2>
                <p className="text-gray-600">Manage students and allocate questions</p>
              </div>
            </div>

            {/* Add Student */}
            <Card>
              <CardHeader>
                <CardTitle>Add New Student</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Input
                    placeholder="Student name"
                    value={newStudentName}
                    onChange={(e) => setNewStudentName(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && addStudent()}
                  />
                  <Button onClick={addStudent}>Add Student</Button>
                </div>
              </CardContent>
            </Card>

            {/* Student List */}
            <Card>
              <CardHeader>
                <CardTitle>Students ({students.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {students.map((student) => {
                    const studentAllocations = allocations.filter((a) => a.studentId === student.id)
                    const completedCount = studentAllocations.filter((a) => a.isCompleted).length

                    return (
                      <Card key={student.id} className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-semibold">{student.name}</h3>
                            <p className="text-sm text-gray-600">
                              {studentAllocations.length} questions assigned • {completedCount} completed
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                // Show allocation dialog for this student
                              }}
                            >
                              Allocate Questions
                            </Button>
                            <Button variant="destructive" size="sm" onClick={() => removeStudent(student.id)}>
                              Remove
                            </Button>
                          </div>
                        </div>

                        {/* Show allocated questions */}
                        {studentAllocations.length > 0 && (
                          <div className="mt-4 space-y-2">
                            <Label className="text-sm font-medium">Allocated Questions:</Label>
                            {studentAllocations.map((allocation) => {
                              const question = questions.find((q) => q.id === allocation.questionId)
                              return question ? (
                                <div
                                  key={allocation.id}
                                  className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded"
                                >
                                  <span>
                                    {question.subject} - {question.originalQuestion.substring(0, 50)}...
                                  </span>
                                  <Button variant="ghost" size="sm" onClick={() => removeAllocation(allocation.id)}>
                                    Remove
                                  </Button>
                                </div>
                              ) : null
                            })}
                          </div>
                        )}
                      </Card>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Assignments Tab */}
          <TabsContent value="assignments" className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold">Assignment Management</h2>
                <p className="text-gray-600">Create and manage assignments for your students</p>
              </div>
              <CreateAssignmentDialog questions={questions} onCreateAssignment={createAssignment} />
            </div>

            <AssignmentList assignments={assignments} questions={questions} />
          </TabsContent>

          <TabsContent value="student" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Student Assignment Portal</CardTitle>
                <CardDescription>Enter your name to see your allocated questions and assignments</CardDescription>
              </CardHeader>
              <CardContent>
                <StudentPortal
                  questions={questions.filter((q) => q.isActive)}
                  assignments={assignments.filter((a) => a.isActive)}
                  onSubmit={submitAnswer}
                  getAllocatedQuestions={getAllocatedQuestionsForStudent}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Submissions Tab */}
          <TabsContent value="submissions" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Student Submissions</CardTitle>
                <CardDescription>View and analyze student responses with AI-powered evaluation</CardDescription>
              </CardHeader>
              <CardContent>
                <SubmissionsView submissions={submissions} questions={questions} assignments={assignments} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <AnalyticsDashboard questions={questions} submissions={submissions} assignments={assignments} />
          </TabsContent>
        </Tabs>

        <footer className="mt-16 pt-8 border-t border-purple-200/50">
          <div className="text-center">
            <p className="text-gray-600 font-medium">
              Made by <span className="gradient-text-animated font-bold">Manvendra Singh Tanwar</span>
            </p>
          </div>
        </footer>
      </div>

      {showAllocationDialog && (
        <QuestionAllocationDialog
          isOpen={showAllocationDialog}
          onClose={() => setShowAllocationDialog(false)}
          questions={questions.filter((q) => q.isActive)}
          students={students}
          onAllocate={allocateQuestion}
          preSelectedQuestions={selectedQuestions}
        />
      )}
    </div>
  )
}

function QuestionGeneratorForm({
  onGenerate,
  isGenerating,
  students,
}: {
  onGenerate: (
    question: string,
    subject: string,
    difficulty: string,
    category: string,
    tags: string[],
    bulkCount?: number,
    autoAllocate?: boolean,
  ) => void
  isGenerating: boolean
  students: Student[]
}) {
  const [question, setQuestion] = useState("")
  const [subject, setSubject] = useState("")
  const [difficulty, setDifficulty] = useState("Medium")
  const [category, setCategory] = useState("")
  const [tags, setTags] = useState("")
  const [generationMode, setGenerationMode] = useState<"single" | "bulk">("single")
  const [bulkCount, setBulkCount] = useState(students.length)
  const [autoAllocate, setAutoAllocate] = useState(true)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (question.trim() && subject.trim()) {
      const tagArray = tags
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0)

      if (generationMode === "bulk") {
        onGenerate(question, subject, difficulty, category, tagArray, bulkCount, autoAllocate)
      } else {
        onGenerate(question, subject, difficulty, category, tagArray)
      }

      setQuestion("")
      setSubject("")
      setCategory("")
      setTags("")
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="question">Original Lab Question</Label>
        <Textarea
          id="question"
          placeholder="Enter your lab question here..."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          className="mt-1"
          rows={4}
        />
      </div>

      <div>
        <Label>Generation Mode</Label>
        <div className="flex gap-4 mt-2">
          <label className="flex items-center space-x-2">
            <input
              type="radio"
              value="single"
              checked={generationMode === "single"}
              onChange={(e) => setGenerationMode(e.target.value as "single" | "bulk")}
            />
            <span>Single Question (4 variations)</span>
          </label>
          <label className="flex items-center space-x-2">
            <input
              type="radio"
              value="bulk"
              checked={generationMode === "bulk"}
              onChange={(e) => setGenerationMode(e.target.value as "single" | "bulk")}
            />
            <span>Bulk Generation (Unique questions for students)</span>
          </label>
        </div>
      </div>

      {generationMode === "bulk" && (
        <div className="bg-blue-50 p-4 rounded-lg space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="bulkCount">Number of Questions</Label>
              <Input
                id="bulkCount"
                type="number"
                min="1"
                max="50"
                value={bulkCount}
                onChange={(e) => setBulkCount(Number.parseInt(e.target.value) || 1)}
                className="mt-1"
              />
              <p className="text-sm text-gray-600 mt-1">You have {students.length} students registered</p>
            </div>
            <div className="flex items-center space-x-2 mt-6">
              <input
                type="checkbox"
                id="autoAllocate"
                checked={autoAllocate}
                onChange={(e) => setAutoAllocate(e.target.checked)}
              />
              <Label htmlFor="autoAllocate">Auto-allocate to students</Label>
            </div>
          </div>
          <div className="text-sm text-blue-700">
            {autoAllocate
              ? `Will generate ${bulkCount} unique questions and automatically assign them to ${Math.min(bulkCount, students.length)} students.`
              : `Will generate ${bulkCount} unique questions for manual allocation.`}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="subject">Subject</Label>
          <Input
            id="subject"
            placeholder="e.g., Chemistry, Physics, Biology"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="category">Category</Label>
          <Input
            id="category"
            placeholder="e.g., Lab Experiment, Theory, Problem Solving"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="mt-1"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="difficulty">Difficulty Level</Label>
          <Select value={difficulty} onValueChange={setDifficulty}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Easy">Easy</SelectItem>
              <SelectItem value="Medium">Medium</SelectItem>
              <SelectItem value="Hard">Hard</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="tags">Tags (comma-separated)</Label>
          <Input
            id="tags"
            placeholder="e.g., organic chemistry, titration, analysis"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className="mt-1"
          />
        </div>
      </div>
      <Button type="submit" disabled={isGenerating || !question.trim() || !subject.trim()} className="w-full">
        {isGenerating
          ? generationMode === "bulk"
            ? `Generating ${bulkCount} Questions...`
            : "Generating Questions..."
          : generationMode === "bulk"
            ? `Generate ${bulkCount} Unique Questions`
            : "Generate Question Variations"}
      </Button>
    </form>
  )
}

const QuestionAllocationDialog = ({
  isOpen,
  onClose,
  questions,
  students,
  onAllocate,
  preSelectedQuestions = [],
}: {
  isOpen: boolean
  onClose: () => void
  questions: Question[]
  students: Student[]
  onAllocate: (questionId: string, studentIds: string[]) => void
  preSelectedQuestions?: string[]
}) => {
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([])
  const [selectedStudents, setSelectedStudents] = useState<string[]>([])

  useEffect(() => {
    setSelectedQuestions(preSelectedQuestions)
  }, [preSelectedQuestions.join(",")])

  useEffect(() => {
    if (isOpen) {
      setSelectedQuestions(preSelectedQuestions)
      setSelectedStudents([])
    }
  }, [isOpen, preSelectedQuestions.join(",")])

  const handleAllocate = () => {
    if (selectedQuestions.length > 0 && selectedStudents.length > 0) {
      let totalAllocations = 0
      selectedQuestions.forEach((questionId) => {
        onAllocate(questionId, selectedStudents)
        totalAllocations += selectedStudents.length
      })

      alert(
        `Successfully allocated ${selectedQuestions.length} questions to ${selectedStudents.length} students (${totalAllocations} total assignments)!`,
      )

      setSelectedQuestions([])
      setSelectedStudents([])
      onClose()
    } else {
      alert("Please select at least one question and one student.")
    }
  }

  return (
    <div
      className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-50 transition-opacity duration-300 ${isOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
    >
      <div className="flex items-center justify-center min-h-screen p-4">
        <div
          className={`bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden transition-transform duration-300 ${isOpen ? "scale-100" : "scale-95"}`}
        >
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Allocate Questions to Students</h2>
              <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Questions Selection */}
              <div>
                <h3 className="text-lg font-semibold mb-4 text-gray-900">Select Questions</h3>
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {questions.map((question) => (
                    <label
                      key={question.id}
                      className="flex items-start space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedQuestions.includes(question.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedQuestions([...selectedQuestions, question.id])
                          } else {
                            setSelectedQuestions(selectedQuestions.filter((id) => id !== question.id))
                          }
                        }}
                        className="mt-1 w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{question.subject}</div>
                        <div className="text-sm text-gray-600 line-clamp-2">{question.originalQuestion}</div>
                        <div className="text-xs text-gray-500 mt-1">Difficulty: {question.difficulty}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Students Selection */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Select Students</h3>
                  <button
                    onClick={() => {
                      if (selectedStudents.length === students.length) {
                        setSelectedStudents([])
                      } else {
                        setSelectedStudents(students.map((s) => s.id))
                      }
                    }}
                    className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                  >
                    {selectedStudents.length === students.length ? "Deselect All" : "Select All"}
                  </button>
                </div>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {students.map((student) => (
                    <label
                      key={student.id}
                      className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedStudents.includes(student.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedStudents([...selectedStudents, student.id])
                          } else {
                            setSelectedStudents(selectedStudents.filter((id) => id !== student.id))
                          }
                        }}
                        className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{student.name}</div>
                        <div className="text-sm text-gray-600">{student.email}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Allocation Summary */}
            {selectedQuestions.length > 0 && selectedStudents.length > 0 && (
              <div className="mt-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
                <h4 className="font-semibold text-purple-900 mb-2">Allocation Summary</h4>
                <p className="text-purple-700">
                  You will create <strong>{selectedQuestions.length * selectedStudents.length}</strong> assignments (
                  {selectedQuestions.length} questions × {selectedStudents.length} students)
                </p>
              </div>
            )}
          </div>

          <div className="p-6 border-t border-gray-100 bg-gray-50">
            <div className="flex justify-end space-x-3">
              <button
                onClick={onClose}
                className="px-6 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAllocate}
                disabled={selectedQuestions.length === 0 || selectedStudents.length === 0}
                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Allocate Questions
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function QuestionLibrary({
  questions,
  onDelete,
  onToggleStatus,
  selectedQuestions,
  onSelectionChange,
  students,
  onAllocate,
}: {
  questions: Question[]
  onDelete: (id: string) => void
  onToggleStatus: (id: string) => void
  selectedQuestions: string[]
  onSelectionChange: (ids: string[]) => void
  students: Student[]
  onAllocate: (questionId: string, studentIds: string[]) => void
}) {
  const [showAllocationDialog, setShowAllocationDialog] = useState(false)

  if (questions.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No questions generated yet. Create your first question above.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {selectedQuestions.length > 0 && (
        <div className="flex gap-2 p-4 bg-blue-50 rounded-lg">
          <Button
            variant="outline"
            onClick={() => setShowAllocationDialog(true)}
            className="bg-blue-600 text-white hover:bg-blue-700"
          >
            <Users className="h-4 w-4 mr-2" />
            Allocate {selectedQuestions.length} Selected Questions
          </Button>
          <Button variant="outline" size="sm" className="bg-transparent">
            <Download className="h-4 w-4 mr-2" />
            Export Questions
          </Button>
          <Button variant="outline" size="sm" className="bg-transparent">
            <Copy className="h-4 w-4 mr-2" />
            Duplicate Selected
          </Button>
          <Button variant="outline" size="sm" onClick={() => onSelectionChange([])} className="bg-transparent">
            Clear Selection
          </Button>
        </div>
      )}

      {showAllocationDialog && (
        <QuestionAllocationDialog
          isOpen={showAllocationDialog}
          onClose={() => setShowAllocationDialog(false)}
          questions={questions.filter((q) => q.isActive)}
          students={students}
          onAllocate={onAllocate}
          preSelectedQuestions={selectedQuestions}
        />
      )}
      {questions.map((question) => (
        <Card key={question.id} className={`${!question.isActive ? "opacity-60" : ""}`}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    checked={selectedQuestions.includes(question.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        onSelectionChange([...selectedQuestions, question.id])
                      } else {
                        onSelectionChange(selectedQuestions.filter((id) => id !== question.id))
                      }
                    }}
                    className="rounded"
                  />
                  <CardTitle className="text-lg">{question.subject}</CardTitle>
                  {!question.isActive && <Badge variant="secondary">Inactive</Badge>}
                </div>
                <div className="flex gap-2 mb-2">
                  <Badge variant="secondary">{question.category}</Badge>
                  <Badge
                    variant={
                      question.difficulty === "Easy"
                        ? "default"
                        : question.difficulty === "Medium"
                          ? "secondary"
                          : "destructive"
                    }
                  >
                    {question.difficulty}
                  </Badge>
                  {question.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => onToggleStatus(question.id)}>
                  {question.isActive ? "Deactivate" : "Activate"}
                </Button>
                <Button variant="outline" size="sm">
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDelete(question.id)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-gray-600">Original Question:</Label>
                <p className="mt-1 p-3 bg-gray-50 rounded-md">{question.originalQuestion}</p>
              </div>
              <Separator />
              <div>
                <Label className="text-sm font-medium text-gray-600">Generated Variations:</Label>
                <div className="mt-2 space-y-2">
                  {question.generatedVariations.map((variation, index) => (
                    <div key={index} className="p-3 bg-blue-50 rounded-md border-l-4 border-blue-400">
                      <p className="text-sm font-medium text-blue-800">Variation {index + 1}:</p>
                      <p className="text-blue-700">{variation}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// Create Assignment Dialog Component
function CreateAssignmentDialog({
  questions,
  onCreateAssignment,
}: {
  questions: Question[]
  onCreateAssignment: (title: string, description: string, questionIds: string[], dueDate: Date) => void
}) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([])
  const [dueDate, setDueDate] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (title.trim() && selectedQuestions.length > 0 && dueDate) {
      onCreateAssignment(title, description, selectedQuestions, new Date(dueDate))
      setTitle("")
      setDescription("")
      setSelectedQuestions([])
      setDueDate("")
      setOpen(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Create Assignment
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create New Assignment</DialogTitle>
          <DialogDescription>
            Create an assignment by selecting questions for your students to complete.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="assignment-title">Assignment Title</Label>
            <Input
              id="assignment-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter assignment title"
            />
          </div>
          <div>
            <Label htmlFor="assignment-description">Description</Label>
            <Textarea
              id="assignment-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter assignment description"
              rows={3}
            />
          </div>
          <div>
            <Label htmlFor="due-date">Due Date</Label>
            <Input id="due-date" type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div>
            <Label>Select Questions</Label>
            <div className="mt-2 max-h-60 overflow-y-auto space-y-2 border rounded-md p-3">
              {questions
                .filter((q) => q.isActive)
                .map((question) => (
                  <div key={question.id} className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={selectedQuestions.includes(question.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedQuestions([...selectedQuestions, question.id])
                        } else {
                          setSelectedQuestions(selectedQuestions.filter((id) => id !== question.id))
                        }
                      }}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {question.subject} - {question.category}
                      </p>
                      <p className="text-xs text-gray-600">{question.originalQuestion.substring(0, 100)}...</p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!title.trim() || selectedQuestions.length === 0 || !dueDate}>
              Create Assignment
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// Assignment List Component
function AssignmentList({
  assignments,
  questions,
}: {
  assignments: Assignment[]
  questions: Question[]
}) {
  if (assignments.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-8 text-gray-500">
          No assignments created yet. Create your first assignment above.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {assignments.map((assignment) => (
        <Card key={assignment.id}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle>{assignment.title}</CardTitle>
                <CardDescription>{assignment.description}</CardDescription>
              </div>
              <div className="flex gap-2">
                <Badge variant={assignment.isActive ? "default" : "secondary"}>
                  {assignment.isActive ? "Active" : "Inactive"}
                </Badge>
                <Badge variant="outline">Due: {assignment.dueDate.toLocaleDateString()}</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div>
              <Label className="text-sm font-medium text-gray-600">Questions ({assignment.questionIds.length}):</Label>
              <div className="mt-2 space-y-1">
                {assignment.questionIds.map((questionId) => {
                  const question = questions.find((q) => q.id === questionId)
                  return question ? (
                    <div key={questionId} className="text-sm p-2 bg-gray-50 rounded">
                      <span className="font-medium">{question.subject}</span> -{" "}
                      {question.originalQuestion.substring(0, 80)}...
                    </div>
                  ) : null
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function StudentPortal({
  questions,
  assignments,
  onSubmit,
  getAllocatedQuestions,
}: {
  questions: Question[]
  assignments: Assignment[]
  onSubmit: (
    questionId: string,
    studentName: string,
    answer: string,
    assignmentId?: string,
  ) => Promise<StudentSubmission>
  getAllocatedQuestions: (studentName: string) => Question[]
}) {
  const [mode, setMode] = useState<"question" | "assignment">("question")
  const [selectedQuestion, setSelectedQuestion] = useState<string>("")
  const [selectedAssignment, setSelectedAssignment] = useState<string>("")
  const [studentName, setStudentName] = useState("")
  const [answer, setAnswer] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [lastSubmission, setLastSubmission] = useState<StudentSubmission | null>(null)
  const [showFeedback, setShowFeedback] = useState(false)

  const allocatedQuestions = studentName ? getAllocatedQuestions(studentName) : []
  const availableQuestions = mode === "question" ? allocatedQuestions : questions.filter((q) => q.isActive)

  const currentQuestion = questions.find((q) => q.id === selectedQuestion)
  const currentAssignment = assignments.find((a) => a.id === selectedAssignment)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedQuestion && studentName.trim() && answer.trim()) {
      setIsSubmitting(true)
      try {
        const submission = await onSubmit(selectedQuestion, studentName, answer, selectedAssignment || undefined)
        setLastSubmission(submission)
        setShowFeedback(true)
        setAnswer("")
      } catch (error) {
        alert("Error submitting answer. Please try again.")
      } finally {
        setIsSubmitting(false)
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-4">
        <Button
          variant={mode === "question" ? "default" : "outline"}
          onClick={() => setMode("question")}
          className="flex-1"
        >
          Individual Questions
          <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">Allocated Questions</span>
        </Button>
        <Button
          variant={mode === "assignment" ? "default" : "outline"}
          onClick={() => setMode("assignment")}
          className="flex-1"
        >
          Assignment Mode
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="studentName">Student Name</Label>
          <Input
            id="studentName"
            value={studentName}
            onChange={(e) => setStudentName(e.target.value)}
            placeholder="Enter your full name"
            required
          />
          {studentName && (
            <div className="mt-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm font-medium text-blue-900">
                📚 {allocatedQuestions.length} questions allocated to you
              </p>
              {allocatedQuestions.length > 0 && (
                <div className="mt-3 space-y-3">
                  <p className="text-xs text-blue-700 font-medium">Your allocated questions:</p>
                  {allocatedQuestions.map((q, index) => (
                    <div key={q.id} className="p-3 bg-white rounded-md border border-blue-200">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="secondary" className="text-xs">
                          {q.subject}
                        </Badge>
                        <Badge
                          variant={
                            q.difficulty === "Easy"
                              ? "default"
                              : q.difficulty === "Medium"
                                ? "secondary"
                                : "destructive"
                          }
                          className="text-xs"
                        >
                          {q.difficulty}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-800 font-medium mb-1">Question {index + 1}:</p>
                      <p className="text-sm text-gray-700 leading-relaxed">{q.originalQuestion}</p>
                      {q.generatedVariations.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-gray-200">
                          <p className="text-xs text-gray-600 mb-1">Available variations:</p>
                          {q.generatedVariations.map((variation, vIndex) => (
                            <div key={vIndex} className="mt-1 p-2 bg-gray-50 rounded text-xs text-gray-600">
                              <span className="font-medium">Variation {vIndex + 1}:</span> {variation}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {allocatedQuestions.length === 0 && (
                <p className="text-xs text-orange-600 mt-1">
                  ⚠️ No questions allocated to you yet. Please contact your teacher.
                </p>
              )}
            </div>
          )}
        </div>

        {mode === "assignment" ? (
          <div>
            <Label htmlFor="assignment-select">Select Assignment</Label>
            <Select value={selectedAssignment} onValueChange={setSelectedAssignment}>
              <SelectTrigger>
                <SelectValue placeholder="Choose an assignment..." />
              </SelectTrigger>
              <SelectContent>
                {assignments.map((assignment) => (
                  <SelectItem key={assignment.id} value={assignment.id}>
                    {assignment.title} (Due: {assignment.dueDate.toLocaleDateString()})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {currentAssignment && (
              <div className="mt-4">
                <Label>Assignment Questions ({currentAssignment.questionIds.length} total):</Label>
                <Select value={selectedQuestion} onValueChange={setSelectedQuestion}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a question to answer..." />
                  </SelectTrigger>
                  <SelectContent>
                    {currentAssignment.questionIds.map((questionId, index) => {
                      const question = questions.find((q) => q.id === questionId)
                      return question ? (
                        <SelectItem key={questionId} value={questionId}>
                          <div className="flex flex-col items-start">
                            <span className="font-medium">
                              Question {index + 1}: {question.subject}
                            </span>
                            <span className="text-sm text-gray-600">
                              {question.originalQuestion.substring(0, 60)}...
                            </span>
                          </div>
                        </SelectItem>
                      ) : null
                    })}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        ) : (
          <div>
            <Label htmlFor="question-select">Select Question</Label>
            <Select value={selectedQuestion} onValueChange={setSelectedQuestion}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a question..." />
              </SelectTrigger>
              <SelectContent>
                {availableQuestions.map((question) => (
                  <SelectItem key={question.id} value={question.id}>
                    {question.subject} - {question.difficulty} - {question.originalQuestion.substring(0, 60)}...
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {availableQuestions.length === 0 && (
              <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <p className="text-sm text-orange-700">
                  No questions have been allocated to you yet. Please contact your teacher to get assigned questions.
                </p>
              </div>
            )}
          </div>
        )}

        {currentQuestion && (
          <Card className="bg-gray-50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                📝 {currentQuestion.subject}
                <Badge variant="secondary">{currentQuestion.difficulty}</Badge>
                <Badge variant="outline" className="text-xs">
                  {currentQuestion.category}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <Label className="text-sm font-medium text-gray-600">Question:</Label>
                <div className="mt-2 p-4 bg-white rounded-md border border-gray-200">
                  <p className="text-gray-800 leading-relaxed">{currentQuestion.originalQuestion}</p>
                </div>
              </div>

              {currentQuestion.generatedVariations.length > 0 && (
                <div className="mb-4">
                  <Label className="text-sm font-medium text-gray-600">Alternative Variations (for reference):</Label>
                  <div className="mt-2 space-y-2">
                    {currentQuestion.generatedVariations.map((variation, index) => (
                      <div key={index} className="p-3 bg-blue-50 rounded-md border-l-4 border-blue-400">
                        <p className="text-xs font-medium text-blue-800 mb-1">Variation {index + 1}:</p>
                        <p className="text-sm text-blue-700">{variation}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="answer">Your Answer</Label>
                <Textarea
                  id="answer"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Type your detailed answer here..."
                  rows={6}
                  required
                />
              </div>
            </CardContent>
          </Card>
        )}

        <Button
          type="submit"
          disabled={!selectedQuestion || !studentName.trim() || !answer.trim() || isSubmitting}
          className="w-full"
        >
          {isSubmitting ? "Submitting..." : "Submit Answer"}
        </Button>
      </form>

      {showFeedback && lastSubmission && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="text-green-800 flex items-center gap-2">✅ Answer Submitted Successfully!</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-600">Score</p>
                <p className="text-2xl font-bold text-green-600">{lastSubmission.aiScore}/100</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Submitted</p>
                <p className="text-sm text-gray-800">{new Date(lastSubmission.submittedAt).toLocaleString()}</p>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-600 mb-2">AI Feedback</p>
              <div className="bg-white p-3 rounded border">
                <p className="text-sm text-gray-700">{lastSubmission.feedback}</p>
              </div>
            </div>

            <Button onClick={() => setShowFeedback(false)} variant="outline" size="sm">
              Continue
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// Enhanced Submissions View Component
function SubmissionsView({
  submissions,
  questions,
  assignments,
}: {
  submissions: StudentSubmission[]
  questions: Question[]
  assignments: Assignment[]
}) {
  if (submissions.length === 0) {
    return <div className="text-center py-8 text-gray-500">No submissions yet.</div>
  }

  return (
    <div className="space-y-4">
      {submissions.map((submission) => {
        const question = questions.find((q) => q.id === submission.questionId)
        const assignment = assignments.find((a) => a.id === submission.assignmentId)
        return (
          <Card key={submission.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">{submission.studentName}</CardTitle>
                  {assignment && <p className="text-sm text-gray-600">Assignment: {assignment.title}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">Score: {submission.aiScore}%</Badge>
                  <Badge variant="secondary">{new Date(submission.submittedAt).toLocaleDateString()}</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-gray-600">Question:</Label>
                <p className="mt-1 p-2 bg-gray-50 rounded text-sm">
                  {question?.originalQuestion || "Question not found"}
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600">Student Answer:</Label>
                <p className="mt-1 p-2 bg-blue-50 rounded text-sm">{submission.answer}</p>
              </div>
              {submission.feedback && (
                <div>
                  <Label className="text-sm font-medium text-gray-600">AI Feedback:</Label>
                  <p className="mt-1 p-2 bg-green-50 rounded text-sm text-green-800">{submission.feedback}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

// Analytics Dashboard Component
function AnalyticsDashboard({
  questions,
  submissions,
  assignments,
}: {
  questions: Question[]
  submissions: StudentSubmission[]
  assignments: Assignment[]
}) {
  const avgScore =
    submissions.length > 0
      ? Math.round(submissions.reduce((acc, sub) => acc + (sub.aiScore || 0), 0) / submissions.length)
      : 0

  const subjectStats = questions.reduce(
    (acc, q) => {
      acc[q.subject] = (acc[q.subject] || 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Total Questions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-indigo-600">{questions.length}</div>
            <p className="text-sm text-gray-600">{questions.filter((q) => q.isActive).length} active</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Assignments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{assignments.length}</div>
            <p className="text-sm text-gray-600">{assignments.filter((a) => a.isActive).length} active</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Total Submissions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{submissions.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Average Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600">{avgScore}%</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Questions by Subject</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(subjectStats).map(([subject, count]) => (
                <div key={subject} className="flex justify-between items-center">
                  <span className="text-sm">{subject}</span>
                  <Badge variant="secondary">{count}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              {submissions.slice(0, 5).map((submission) => (
                <div key={submission.id} className="flex justify-between">
                  <span>{submission.studentName} submitted</span>
                  <span className="text-gray-500">{new Date(submission.submittedAt).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
