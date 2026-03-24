"use client";

import { useEffect, useRef, useState } from "react";
import {
    Button,
    Card,
    Collapse,
    Empty,
    Flex,
    Form,
    Input,
    Modal,
    Radio,
    Select,
    Space,
    Table,
    Tag,
    Typography,
    message,
} from "antd";
import { AudioOutlined, CopyOutlined, DeleteOutlined, StopOutlined } from "@ant-design/icons";

import { api } from "~/trpc/react";

const { TextArea } = Input;

interface ProposalMeeting {
    id: number;
    proposalId: number;
    title: string;
    description?: string;
    audioUrl?: string;
    assemblyAiTranscriptId?: string;
    transcriptionType: "assembly_ai" | "manual_transcript" | "manual_notes";
    manualTranscript?: string;
    summary?: string;
    meetingAnalysis?: string;
    nextSteps?: string;
    recordingDate?: Date;
    createdAt: Date;
    speakers?: Array<{
        id: number;
        speakerId: number;
        speakerLabel: string;
        speakerName?: string | null;
        linkedStakeholder?: {
            id: number;
            fullName: string;
        } | null;
    }>;
    transcripts?: Array<{
        id: number;
        speakerId: number;
        speakerLabel: string;
        text: string;
        confidence?: number | null;
        startTime?: number | null;
        endTime?: number | null;
        createdAt?: Date | string;
    }>;
}

type SpeakerDraftState = {
    speakerLabel: string;
    personaId: number | null;
};

export interface MeetingNotesProps {
    proposalId: number;
    proposal: {
        title: string;
        stakeholders: Array<{ personaId: number; persona: { id: number; fullName: string } }>;
    };
}

export function ProposalMeetingNotes({ proposalId, proposal }: MeetingNotesProps) {
    const [showCreateMeeting, setShowCreateMeeting] = useState(false);
    const [selectedMeetingId, setSelectedMeetingId] = useState<number | null>(null);
    const [viewMeeting, setViewMeeting] = useState<ProposalMeeting | null>(null);
    const [deletingMeetingId, setDeletingMeetingId] = useState<number | null>(null);
    const [speakerDrafts, setSpeakerDrafts] = useState<Record<number, SpeakerDraftState>>({});
    const [meetingSummaryDraft, setMeetingSummaryDraft] = useState("");
    const [meetingAnalysisDraft, setMeetingAnalysisDraft] = useState("");
    const [createForm] = Form.useForm();
    const [speakersForm] = Form.useForm();
    const [transcriptionType, setTranscriptionType] = useState<"assembly_ai" | "manual_transcript" | "manual_notes">("manual_notes");
    const [manualSpeakers, setManualSpeakers] = useState<Array<{ speakerId: number; speakerLabel: string; text: string }>>([]);
    const [isStreaming, setIsStreaming] = useState(false);
    const [streamingTranscript, setStreamingTranscript] = useState("");
    const [detectedSpeakers, setDetectedSpeakers] = useState<Array<{ speakerId: number; speakerLabel: string }>>([]);
    const [streamingMeetingId, setStreamingMeetingId] = useState<number | null>(null);
    const [streamConnectionStatus, setStreamConnectionStatus] = useState<"idle" | "connecting" | "connected" | "error">("idle");
    const [isMicActive, setIsMicActive] = useState(false);
    const [audioChunksSent, setAudioChunksSent] = useState(0);
    const [finalSegmentsCount, setFinalSegmentsCount] = useState(0);
    const [lastRealtimeEventAt, setLastRealtimeEventAt] = useState<Date | null>(null);
    const [streamingProtocol, setStreamingProtocol] = useState<"v2" | "v3" | null>(null);
    const [messageApi, contextHolder] = message.useMessage();

    const wsRef = useRef<WebSocket | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const scriptNodeRef = useRef<ScriptProcessorNode | null>(null);
    const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const liveLinesRef = useRef<string[]>([]);

    const meetingNotesQuery = api.proposal.getMeetingNotes.useQuery(
        proposalId > 0 ? { proposalId } : undefined,
        { enabled: proposalId > 0 }
    );

    const realtimeTokenQuery = api.proposal.getRealtimeStreamingToken.useQuery(undefined, {
        enabled: false,
    });

    const createMeetingMutation = api.proposal.createMeetingNote.useMutation({
        onSuccess: async () => {
            await meetingNotesQuery.refetch();
            createForm.resetFields();
            setShowCreateMeeting(false);
            setManualSpeakers([]);
            setIsStreaming(false);
            setStreamingTranscript("");
            setDetectedSpeakers([]);
            messageApi.success("Meeting note created successfully!");
        },
        onError: (error) => messageApi.error(error.message),
    });

    const processMutation = api.proposal.processMeetingTranscription.useMutation({
        onSuccess: async () => {
            await meetingNotesQuery.refetch();
            messageApi.success("Transcription processed successfully!");
        },
        onError: (error) => messageApi.error(error.message),
    });

    const generateSummaryMutation = api.proposal.generateMeetingNotesSummary.useMutation({
        onSuccess: async () => {
            await meetingNotesQuery.refetch();
            messageApi.success("Summary generated successfully!");
        },
        onError: (error) => messageApi.error(error.message),
    });

    const updateMeetingSummaryMutation = api.proposal.updateMeetingSummary.useMutation({
        onError: (error) => messageApi.error(error.message),
    });

    const generateMeetingAnalysisMutation = api.proposal.generateMeetingSummaryAnalysis.useMutation({
        onError: (error) => messageApi.error(error.message),
    });

    const updateMeetingAnalysisMutation = api.proposal.updateMeetingSummaryAnalysis.useMutation({
        onError: (error) => messageApi.error(error.message),
    });

    const generateNextStepsMutation = api.proposal.generateMeetingNotesNextSteps.useMutation({
        onSuccess: async () => {
            await meetingNotesQuery.refetch();
            messageApi.success("Next steps generated successfully!");
        },
        onError: (error) => messageApi.error(error.message),
    });

    const createStreamingNoteMutation = api.proposal.createStreamingMeetingNote.useMutation({
        onSuccess: () => {
            messageApi.success("Streaming session started!");
        },
        onError: (error: any) => messageApi.error(error.message),
    });

    const completeStreamingMutation = api.proposal.completeStreamingTranscription.useMutation({
        onSuccess: async () => {
            await meetingNotesQuery.refetch();
            setIsStreaming(false);
            setStreamingTranscript("");
            setDetectedSpeakers([]);
            setStreamingMeetingId(null);
            messageApi.success("Transcription completed!");
        },
        onError: (error: any) => messageApi.error(error.message),
    });

    const deleteMeetingMutation = api.proposal.deleteMeetingNote.useMutation({
        onMutate: (input) => {
            setDeletingMeetingId(input.meetingId);
        },
        onSuccess: async () => {
            await meetingNotesQuery.refetch();
            setViewMeeting(null);
            messageApi.success("Meeting note deleted");
        },
        onError: (error) => messageApi.error(error.message),
        onSettled: () => {
            setDeletingMeetingId(null);
        },
    });

    const linkSpeakerMutation = api.proposal.linkSpeakerToStakeholder.useMutation({
        onError: (error) => messageApi.error(error.message),
    });

    const renameSpeakerMutation = api.proposal.renameMeetingSpeaker.useMutation({
        onError: (error) => messageApi.error(error.message),
    });

    const meetings = (meetingNotesQuery.data ?? []) as ProposalMeeting[];

    const handleAddSpeaker = (values: any) => {
        const newSpeaker = {
            speakerId: values.speakerId,
            speakerLabel: values.speakerLabel,
            text: values.text,
        };
        setManualSpeakers([...manualSpeakers, newSpeaker]);
        speakersForm.resetFields();
        messageApi.success("Speaker segment added!");
    };

    const handleRemoveSpeaker = (index: number) => {
        setManualSpeakers(manualSpeakers.filter((_, i) => i !== index));
    };

    const pcm16ToBase64 = (pcm16Data: Int16Array) => {
        const uint8 = new Uint8Array(pcm16Data.buffer);
        let binary = "";
        const chunkSize = 0x8000;
        for (let i = 0; i < uint8.length; i += chunkSize) {
            binary += String.fromCharCode(...uint8.subarray(i, i + chunkSize));
        }
        return btoa(binary);
    };

    const floatTo16BitPCM = (input: Float32Array) => {
        const output = new Int16Array(input.length);
        for (let i = 0; i < input.length; i += 1) {
            const sample = Math.max(-1, Math.min(1, input[i] ?? 0));
            output[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
        }
        return output;
    };

    const cleanupLiveStreaming = () => {
        try {
            scriptNodeRef.current?.disconnect();
            sourceNodeRef.current?.disconnect();
            wsRef.current?.close();
            mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
            void audioContextRef.current?.close();
        } catch {
            // Ignore cleanup errors.
        }

        wsRef.current = null;
        mediaStreamRef.current = null;
        audioContextRef.current = null;
        scriptNodeRef.current = null;
        sourceNodeRef.current = null;
        setStreamingProtocol(null);
        setIsMicActive(false);
        setStreamConnectionStatus("idle");
    };

    const handleStartStreaming = async (values: any) => {
        try {
            await createForm.validateFields(["title"]);
            const meeting = await createStreamingNoteMutation.mutateAsync({
                proposalId,
                title: values.title,
                description: values.description,
                recordingDate: values.recordingDate,
            });

            if (!meeting) {
                messageApi.error("Failed to create streaming session");
                return;
            }

            const tokenResponse = await realtimeTokenQuery.refetch();
            const token = tokenResponse.data?.token;
            const wsUrl = tokenResponse.data?.wsUrl;
            const tokenError = tokenResponse.data?.error;

            if (!token || !wsUrl) {
                messageApi.error(tokenError ?? "Failed to get AssemblyAI realtime token");
                return;
            }

            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true,
                },
            });

            const audioContext = new AudioContext({ sampleRate: 16000 });
            const sourceNode = audioContext.createMediaStreamSource(stream);
            const scriptNode = audioContext.createScriptProcessor(4096, 1, 1);
            const isV3 = wsUrl.includes("/v3/") || wsUrl.includes("streaming.assemblyai.com/v3");
            const finalWsUrl = isV3
                ? `${wsUrl}?token=${encodeURIComponent(token)}&sample_rate=${audioContext.sampleRate}&speech_model=universal-streaming-english&format_turns=true&speaker_labels=true`
                : `${wsUrl}?sample_rate=${audioContext.sampleRate}&token=${encodeURIComponent(token)}`;
            const socket = new WebSocket(finalWsUrl);

            setStreamConnectionStatus("connecting");
            setStreamingProtocol(isV3 ? "v3" : "v2");
            setAudioChunksSent(0);
            setFinalSegmentsCount(0);
            setLastRealtimeEventAt(null);

            wsRef.current = socket;
            mediaStreamRef.current = stream;
            audioContextRef.current = audioContext;
            sourceNodeRef.current = sourceNode;
            scriptNodeRef.current = scriptNode;
            liveLinesRef.current = [];
            setIsMicActive(stream.getAudioTracks().some((track) => track.readyState === "live"));

            socket.onopen = () => {
                setStreamConnectionStatus("connected");
                messageApi.success("Live microphone streaming connected");
            };

            socket.onmessage = (event) => {
                try {
                    const payload = JSON.parse(String(event.data)) as {
                        type?: string;
                        message_type?: string;
                        text?: string;
                        speaker?: string | number;
                        transcript?: string;
                        speaker_label?: string;
                        end_of_turn?: boolean;
                    };

                    const isV3Turn = payload.type === "Turn";
                    const isV2Final = payload.message_type === "FinalTranscript";

                    if (isV3Turn) {
                        const text = payload.transcript?.trim();
                        if (!text) {
                            return;
                        }

                        const speakerLabel = payload.speaker_label?.trim() || "Speaker 1";
                        const isFinalTurn = payload.end_of_turn !== false;

                        if (isFinalTurn) {
                            liveLinesRef.current.push(`${speakerLabel}: ${text}`);
                            setStreamingTranscript(liveLinesRef.current.join("\n"));
                            setFinalSegmentsCount((prev) => prev + 1);
                        } else {
                            setStreamingTranscript([...liveLinesRef.current, `${speakerLabel}: ${text}`].join("\n"));
                        }

                        setLastRealtimeEventAt(new Date());
                        setDetectedSpeakers((prev) => {
                            if (prev.some((item) => item.speakerLabel === speakerLabel)) {
                                return prev;
                            }
                            return [...prev, { speakerId: prev.length + 1, speakerLabel }];
                        });
                        return;
                    }

                    if (isV2Final) {
                        const text = payload.text?.trim();
                        if (!text) {
                            return;
                        }

                        const speakerLabel = payload.speaker
                            ? `Speaker ${String(payload.speaker)}`
                            : "Speaker 1";

                        liveLinesRef.current.push(`${speakerLabel}: ${text}`);
                        setStreamingTranscript(liveLinesRef.current.join("\n"));
                        setFinalSegmentsCount((prev) => prev + 1);
                        setLastRealtimeEventAt(new Date());

                        setDetectedSpeakers((prev) => {
                            if (prev.some((item) => item.speakerLabel === speakerLabel)) {
                                return prev;
                            }
                            return [...prev, { speakerId: prev.length + 1, speakerLabel }];
                        });
                    }
                } catch {
                    // Ignore malformed messages.
                }
            };

            socket.onerror = () => {
                setStreamConnectionStatus("error");
                messageApi.error("Live streaming connection error");
            };

            socket.onclose = () => {
                // Closed intentionally when stopping recording.
            };

            scriptNode.onaudioprocess = (audioEvent) => {
                if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
                    return;
                }

                const inputData = audioEvent.inputBuffer.getChannelData(0);
                const pcm16 = floatTo16BitPCM(inputData);
                if (isV3) {
                    wsRef.current.send(pcm16.buffer);
                } else {
                    const audioData = pcm16ToBase64(pcm16);
                    wsRef.current.send(JSON.stringify({ audio_data: audioData }));
                }
                setAudioChunksSent((prev) => prev + 1);
            };

            sourceNode.connect(scriptNode);
            scriptNode.connect(audioContext.destination);

            setStreamingMeetingId(meeting.id);
            setIsStreaming(true);
            setStreamingTranscript("");
            setDetectedSpeakers([]);
        } catch {
            // Validation or mutation errors are already surfaced by antd/tRPC.
            cleanupLiveStreaming();
        }
    };

    const handleCompleteStreaming = () => {
        if (!streamingMeetingId) {
            messageApi.error("No streaming session is active");
            return;
        }

        const transcript = streamingTranscript.trim();
        if (!transcript) {
            messageApi.error("Transcript is empty");
            return;
        }

        const parsedSpeakerLabels = Array.from(
            new Set(
                transcript
                    .split("\n")
                    .map((line) => line.match(/^([^:]+):\s*(.+)$/)?.[1]?.trim())
                    .filter((label): label is string => Boolean(label))
            )
        );

        const speakers =
            detectedSpeakers.length > 0
                ? detectedSpeakers
                : parsedSpeakerLabels.length > 0
                    ? parsedSpeakerLabels.map((speakerLabel, idx) => ({
                        speakerId: idx + 1,
                        speakerLabel,
                    }))
                    : [{ speakerId: 1, speakerLabel: "Speaker 1" }];

        setDetectedSpeakers(speakers);

        if (wsRef.current?.readyState === WebSocket.OPEN) {
            if (streamingProtocol === "v3") {
                wsRef.current.send(JSON.stringify({ type: "Terminate" }));
            } else {
                wsRef.current.send(JSON.stringify({ terminate_session: true }));
            }
        }
        cleanupLiveStreaming();

        completeStreamingMutation.mutate({
            meetingId: streamingMeetingId,
            transcript,
            speakers,
        });
    };

    const handleCreateMeeting = (values: any) => {
        if (transcriptionType === "assembly_ai") {
            if (!isStreaming) {
                void handleStartStreaming(values);
            }
            return;
        }

        const payload: any = {
            proposalId,
            title: values.title,
            description: values.description,
            transcriptionType,
            recordingDate: values.recordingDate,
        };

        if (transcriptionType === "manual_transcript") {
            payload.manualTranscript = values.manualTranscript;
        }

        createMeetingMutation.mutate(payload);
    };

    const handleCopyTranscript = async () => {
        const text = streamingTranscript.trim();
        if (!text) {
            messageApi.warning("Transcript is empty");
            return;
        }

        try {
            await navigator.clipboard.writeText(text);
            messageApi.success("Transcript copied");
        } catch {
            messageApi.error("Unable to copy transcript");
        }
    };

    const handleDeleteMeeting = (meeting: ProposalMeeting) => {
        Modal.confirm({
            title: "Delete meeting note?",
            content: `This will permanently delete "${meeting.title}" and all related speakers/transcript segments.`,
            okText: "Delete",
            okButtonProps: { danger: true },
            onOk: async () => {
                await deleteMeetingMutation.mutateAsync({ meetingId: meeting.id });
            },
        });
    };

    const refreshViewedMeeting = async (meetingId: number) => {
        const refreshed = await meetingNotesQuery.refetch();
        const updatedMeetings = (refreshed.data ?? []) as ProposalMeeting[];
        const updatedMeeting = updatedMeetings.find((meeting) => meeting.id === meetingId) ?? null;
        setViewMeeting(updatedMeeting);
    };

    const handleRenameSpeaker = async (speaker: NonNullable<ProposalMeeting["speakers"]>[number]) => {
        if (!viewMeeting) {
            return;
        }

        const nextLabel = (speakerDrafts[speaker.id]?.speakerLabel ?? speaker.speakerLabel).trim();
        if (!nextLabel) {
            messageApi.error("Speaker name cannot be empty");
            return;
        }

        if (nextLabel === speaker.speakerLabel) {
            messageApi.info("No speaker name changes to save");
            return;
        }

        await renameSpeakerMutation.mutateAsync({
            meetingId: viewMeeting.id,
            speakerId: speaker.speakerId,
            speakerLabel: nextLabel,
        });

        await refreshViewedMeeting(viewMeeting.id);
        messageApi.success("Speaker renamed");
    };

    const handleAssignSpeaker = async (speaker: NonNullable<ProposalMeeting["speakers"]>[number]) => {
        if (!viewMeeting) {
            return;
        }

        const selectedPersonaId = speakerDrafts[speaker.id]?.personaId ?? speaker.linkedStakeholder?.id ?? null;
        if (!selectedPersonaId) {
            messageApi.error("Select a stakeholder first");
            return;
        }

        await linkSpeakerMutation.mutateAsync({
            meetingId: viewMeeting.id,
            speakerId: speaker.speakerId,
            personaId: selectedPersonaId,
        });

        await refreshViewedMeeting(viewMeeting.id);
        messageApi.success("Speaker assigned to stakeholder");
    };

    const handleGenerateMeetingSummary = async () => {
        if (!viewMeeting) {
            return;
        }

        await generateSummaryMutation.mutateAsync({ meetingId: viewMeeting.id });
        await refreshViewedMeeting(viewMeeting.id);
    };

    const handleSaveMeetingSummary = async () => {
        if (!viewMeeting) {
            return;
        }

        const nextSummary = meetingSummaryDraft.trim();
        if (!nextSummary) {
            messageApi.error("Summary cannot be empty");
            return;
        }

        await updateMeetingSummaryMutation.mutateAsync({
            meetingId: viewMeeting.id,
            summary: nextSummary,
        });

        await refreshViewedMeeting(viewMeeting.id);
        messageApi.success("Summary saved");
    };

    const handleGenerateMeetingAnalysis = async () => {
        if (!viewMeeting) {
            return;
        }

        await generateMeetingAnalysisMutation.mutateAsync({ meetingId: viewMeeting.id });
        await refreshViewedMeeting(viewMeeting.id);
        messageApi.success("Analysis generated with AI");
    };

    const handleSaveMeetingAnalysis = async () => {
        if (!viewMeeting) {
            return;
        }

        const nextAnalysis = meetingAnalysisDraft.trim();
        if (!nextAnalysis) {
            messageApi.error("Analysis cannot be empty");
            return;
        }

        await updateMeetingAnalysisMutation.mutateAsync({
            meetingId: viewMeeting.id,
            meetingAnalysis: nextAnalysis,
        });

        await refreshViewedMeeting(viewMeeting.id);
        messageApi.success("Analysis saved");
    };

    useEffect(() => {
        return () => {
            cleanupLiveStreaming();
        };
    }, []);

    useEffect(() => {
        if (!viewMeeting?.speakers?.length) {
            setSpeakerDrafts({});
            return;
        }

        const nextDrafts: Record<number, SpeakerDraftState> = {};
        for (const speaker of viewMeeting.speakers) {
            nextDrafts[speaker.id] = {
                speakerLabel: speaker.speakerLabel,
                personaId: speaker.linkedStakeholder?.id ?? null,
            };
        }
        setSpeakerDrafts(nextDrafts);
    }, [viewMeeting]);

    useEffect(() => {
        setMeetingSummaryDraft(viewMeeting?.summary ?? "");
    }, [viewMeeting]);

    useEffect(() => {
        setMeetingAnalysisDraft(viewMeeting?.meetingAnalysis ?? "");
    }, [viewMeeting]);

    return (
        <div>
            {contextHolder}

            <Flex justify="space-between" align="center" style={{ marginBottom: 16 }}>
                <Typography.Title level={5} style={{ margin: 0 }}>
                    Meeting Notes
                </Typography.Title>
                <Button
                    type="primary"
                    icon={<AudioOutlined />}
                    onClick={() => setShowCreateMeeting(true)}
                >
                    Add Meeting Note
                </Button>
            </Flex>

            {meetings.length === 0 ? (
                <Empty description="No meeting notes yet. Add one to get started." />
            ) : (
                <Space orientation="vertical" size="large" style={{ width: "100%" }}>
                    {meetings.map((meeting) => (
                        <Card
                            key={meeting.id}
                            title={
                                <Flex justify="space-between" align="center" style={{ width: "100%" }}>
                                    <div>
                                        <Button
                                            type="link"
                                            onClick={() => setViewMeeting(meeting)}
                                            style={{ padding: 0, height: "auto", fontWeight: 600 }}
                                        >
                                            {meeting.title}
                                        </Button>
                                        <br />
                                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                                            {new Date(meeting.recordingDate ?? meeting.createdAt).toLocaleString()}
                                        </Typography.Text>
                                        <br />
                                        <Tag color="blue">
                                            {meeting.transcriptionType === "assembly_ai"
                                                ? "AssemblyAI"
                                                : meeting.transcriptionType === "manual_transcript"
                                                    ? "Manual Transcript"
                                                    : "Manual Notes"}
                                        </Tag>
                                    </div>
                                    <Space>
                                        {meeting.transcriptionType === "assembly_ai" && meeting.assemblyAiTranscriptId && !meeting.summary && (
                                            <Button
                                                size="small"
                                                onClick={() => processMutation.mutate({ meetingId: meeting.id })}
                                                loading={processMutation.isPending}
                                            >
                                                Process Transcript
                                            </Button>
                                        )}
                                        {(meeting.transcriptionType === "manual_transcript" || meeting.transcriptionType === "manual_notes") && !meeting.summary && (
                                            <Button
                                                size="small"
                                                type="primary"
                                                onClick={() => {
                                                    setSelectedMeetingId(meeting.id);
                                                    setShowCreateMeeting(true);
                                                }}
                                            >
                                                Add Speakers
                                            </Button>
                                        )}
                                        <Button
                                            size="small"
                                            danger
                                            icon={<DeleteOutlined />}
                                            onClick={() => handleDeleteMeeting(meeting)}
                                            loading={deletingMeetingId === meeting.id && deleteMeetingMutation.isPending}
                                        >
                                            Delete
                                        </Button>
                                    </Space>
                                </Flex>
                            }
                            size="small"
                        >
                            <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
                                {meeting.description && (
                                    <div>
                                        <Typography.Paragraph>{meeting.description}</Typography.Paragraph>
                                    </div>
                                )}

                                {meeting.audioUrl && (
                                    <div>
                                        <audio
                                            controls
                                            style={{ width: "100%", marginBottom: 8 }}
                                            src={meeting.audioUrl}
                                        />
                                    </div>
                                )}

                                {meeting.manualTranscript && (
                                    <div>
                                        <Typography.Text strong>Transcript:</Typography.Text>
                                        <Card size="small" style={{ marginTop: 8 }} type="inner">
                                            <Typography.Paragraph style={{ marginBottom: 0, whiteSpace: "pre-wrap" }}>
                                                {meeting.manualTranscript}
                                            </Typography.Paragraph>
                                        </Card>
                                    </div>
                                )}

                                {(meeting.summary || meeting.nextSteps) && (
                                    <Collapse
                                        size="small"
                                        items={[
                                            ...(meeting.summary
                                                ? [{
                                                    key: `summary-${meeting.id}`,
                                                    label: "Summary",
                                                    children: (
                                                        <div>
                                                            <Card size="small" style={{ marginTop: 4 }} type="inner">
                                                                <Typography.Paragraph style={{ marginBottom: 0, whiteSpace: "pre-wrap" }}>
                                                                    {meeting.summary}
                                                                </Typography.Paragraph>
                                                            </Card>
                                                            <Button
                                                                type="text"
                                                                size="small"
                                                                onClick={() => generateSummaryMutation.mutate({ meetingId: meeting.id })}
                                                                loading={generateSummaryMutation.isPending}
                                                                style={{ marginTop: 8 }}
                                                            >
                                                                Regenerate Summary
                                                            </Button>
                                                        </div>
                                                    ),
                                                }]
                                                : []),
                                            {
                                                key: `next-steps-${meeting.id}`,
                                                label: "Recommended Next Steps",
                                                children: (
                                                    <div>
                                                        {meeting.summary && (
                                                            <Button
                                                                type="primary"
                                                                onClick={() => generateNextStepsMutation.mutate({ meetingId: meeting.id })}
                                                                loading={generateNextStepsMutation.isPending}
                                                            >
                                                                {meeting.nextSteps ? "Regenerate" : "Generate"} Next Steps
                                                            </Button>
                                                        )}
                                                        {meeting.nextSteps ? (
                                                            <Card size="small" style={{ marginTop: 8 }} type="inner">
                                                                <Typography.Paragraph style={{ marginBottom: 0, whiteSpace: "pre-wrap" }}>
                                                                    {meeting.nextSteps}
                                                                </Typography.Paragraph>
                                                            </Card>
                                                        ) : (
                                                            <Typography.Text type="secondary" style={{ display: "block", marginTop: 8 }}>
                                                                No recommended next steps yet.
                                                            </Typography.Text>
                                                        )}
                                                    </div>
                                                ),
                                            },
                                        ]}
                                    />
                                )}
                            </Space>
                        </Card>
                    ))}
                </Space>
            )}

            <Modal
                open={showCreateMeeting}
                title={selectedMeetingId ? "Add Speakers & Transcript" : "Add Meeting Note"}
                onCancel={() => {
                    setShowCreateMeeting(false);
                    if (selectedMeetingId) {
                        speakersForm.resetFields();
                    } else {
                        createForm.resetFields();
                    }
                    setManualSpeakers([]);
                    setSelectedMeetingId(null);
                    setIsStreaming(false);
                    setStreamingTranscript("");
                    setDetectedSpeakers([]);
                    cleanupLiveStreaming();
                }}
                onOk={() => {
                    if (selectedMeetingId) {
                        if (manualSpeakers.length === 0) {
                            messageApi.error("Please add at least one speaker segment!");
                            return;
                        }
                        processMutation.mutate({
                            meetingId: selectedMeetingId,
                            manualSegments: manualSpeakers,
                        });
                        setShowCreateMeeting(false);
                        setManualSpeakers([]);
                        setSelectedMeetingId(null);
                    } else if (isStreaming) {
                        handleCompleteStreaming();
                    } else {
                        createForm.submit();
                    }
                }}
                okText={selectedMeetingId ? "Process & Continue" : isStreaming ? "Stop & Complete" : "Create"}
                confirmLoading={selectedMeetingId ? processMutation.isPending : isStreaming ? completeStreamingMutation.isPending : createMeetingMutation.isPending}
                width={{
                    xs: '90%',
                    sm: '80%',
                    md: '70%',
                    lg: '60%',
                    xl: '40%',
                    xxl: '40%',
                }}
            >
                {selectedMeetingId ? (
                    <Form
                        form={speakersForm}
                        layout="vertical"
                        onFinish={handleAddSpeaker}
                    >
                        <Typography.Text strong>
                            Add speaker segments to create the transcript
                        </Typography.Text>

                        <Form.Item
                            name="speakerId"
                            label="Speaker ID"
                            rules={[{ required: true, message: "Please enter a speaker ID" }]}
                            style={{ marginTop: 16 }}
                        >
                            <Input type="number" placeholder="e.g., 1" min={0} />
                        </Form.Item>

                        <Form.Item
                            name="speakerLabel"
                            label="Speaker Name/Label"
                            rules={[{ required: true, message: "Please enter a speaker label" }]}
                        >
                            <Input placeholder="e.g., John Smith, CTO" />
                        </Form.Item>

                        <Form.Item
                            name="text"
                            label="What they said..."
                            rules={[{ required: true, message: "Please enter the speaker text" }]}
                        >
                            <TextArea rows={3} placeholder="Enter the text spoken by this speaker" />
                        </Form.Item>

                        <Button type="dashed" htmlType="submit" block>
                            Add Speaker Segment
                        </Button>

                        {manualSpeakers.length > 0 && (
                            <div style={{ marginTop: 16 }}>
                                <Typography.Text strong>Transcript ({manualSpeakers.length} segments)</Typography.Text>
                                <Table
                                    size="small"
                                    style={{ marginTop: 8 }}
                                    columns={[
                                        {
                                            title: "Speaker",
                                            dataIndex: "speakerLabel",
                                            key: "speakerLabel",
                                            width: 100,
                                        },
                                        {
                                            title: "Text",
                                            dataIndex: "text",
                                            key: "text",
                                            ellipsis: true,
                                            render: (text: string) => (
                                                <Typography.Text
                                                    ellipsis={{ tooltip: text }}
                                                    style={{ maxWidth: 250 }}
                                                >
                                                    {text}
                                                </Typography.Text>
                                            ),
                                        },
                                        {
                                            title: "Action",
                                            key: "action",
                                            width: 60,
                                            render: (_, __, index: number) => (
                                                <Button
                                                    type="text"
                                                    danger
                                                    size="small"
                                                    icon={<DeleteOutlined />}
                                                    onClick={() => handleRemoveSpeaker(index)}
                                                />
                                            ),
                                        },
                                    ]}
                                    dataSource={manualSpeakers.map((s, i) => ({ ...s, key: i }))}
                                    pagination={false}
                                />
                            </div>
                        )}
                    </Form>
                ) : (
                    <Form
                        form={createForm}
                        layout="vertical"
                        onFinish={handleCreateMeeting}
                    >
                        <Form.Item
                            name="title"
                            label="Meeting Title"
                            rules={[{ required: true, message: "Please enter a meeting title" }]}
                        >
                            <Input placeholder="e.g., Stakeholder Alignment Meeting" />
                        </Form.Item>

                        <Form.Item name="description" label="Description">
                            <TextArea rows={2} placeholder="Optional meeting notes or context" />
                        </Form.Item>

                        <Form.Item
                            label="Transcription Type"
                            required
                        >
                            <Radio.Group
                                value={transcriptionType}
                                onChange={(e) => {
                                    setTranscriptionType(e.target.value);
                                    setIsStreaming(false);
                                    cleanupLiveStreaming();
                                }}
                            >
                                <Radio.Button value="manual_notes">Manual Notes Only</Radio.Button>
                                <Radio.Button value="manual_transcript">Manual Transcript</Radio.Button>
                                <Radio.Button value="assembly_ai">Live Audio Streaming</Radio.Button>
                            </Radio.Group>
                        </Form.Item>

                        {transcriptionType === "assembly_ai" && (
                            <Button
                                type={isStreaming ? "primary" : "dashed"}
                                icon={isStreaming ? <StopOutlined /> : <AudioOutlined />}
                                onClick={() => {
                                    if (isStreaming) {
                                        handleCompleteStreaming();
                                    } else {
                                        handleStartStreaming(createForm.getFieldsValue());
                                    }
                                }}
                                loading={createStreamingNoteMutation.isPending}
                                block
                                style={{ marginBottom: 16 }}
                            >
                                {isStreaming ? "Stop Recording" : "Start Live Streaming"}
                            </Button>
                        )}

                        {isStreaming && (
                            <Card style={{ marginBottom: 16, backgroundColor: "#f6ffed" }} size="small">
                                <Typography.Text strong>🎙️ Streaming Active</Typography.Text>
                                <TextArea
                                    value={streamingTranscript}
                                    onChange={(e) => setStreamingTranscript(e.target.value)}
                                    rows={6}
                                    placeholder="Real-time transcription will appear here... You can manually edit the transcript."
                                    style={{ marginTop: 8 }}
                                />
                                <Card size="small" type="inner" style={{ marginTop: 12 }}>
                                    <Space wrap>
                                        <Tag color={streamConnectionStatus === "connected" ? "green" : streamConnectionStatus === "error" ? "red" : "gold"}>
                                            Connection: {streamConnectionStatus}
                                        </Tag>
                                        <Tag color={isMicActive ? "green" : "default"}>
                                            Mic: {isMicActive ? "active" : "inactive"}
                                        </Tag>
                                        <Tag>Chunks Sent: {audioChunksSent}</Tag>
                                        <Tag>Final Segments: {finalSegmentsCount}</Tag>
                                        <Tag>
                                            Last Event: {lastRealtimeEventAt ? lastRealtimeEventAt.toLocaleTimeString() : "n/a"}
                                        </Tag>
                                        <Button
                                            size="small"
                                            icon={<CopyOutlined />}
                                            onClick={handleCopyTranscript}
                                        >
                                            Copy Transcript
                                        </Button>
                                    </Space>
                                </Card>
                                {detectedSpeakers.length > 0 && (
                                    <div style={{ marginTop: 12 }}>
                                        <Typography.Text strong>Detected Speakers:</Typography.Text>
                                        <Space wrap style={{ marginTop: 8 }}>
                                            {detectedSpeakers.map((speaker: any, idx: number) => (
                                                <Tag key={idx} color="blue">
                                                    {speaker.speakerLabel}
                                                </Tag>
                                            ))}
                                        </Space>
                                    </div>
                                )}
                            </Card>
                        )}

                        {transcriptionType === "manual_transcript" && (
                            <Form.Item
                                name="manualTranscript"
                                label="Meeting Transcript"
                                rules={[
                                    { required: true, message: "Please paste the meeting transcript" },
                                ]}
                            >
                                <TextArea
                                    rows={5}
                                    placeholder={`Paste your transcript here, e.g.:\n\nJohn Smith: Welcome everyone to today's meeting.\nSarah Johnson: Thank you for having us.\n\nYou can add speakers before or after creating the note.`}
                                />
                            </Form.Item>
                        )}
                    </Form>
                )}
            </Modal>

            <Modal
                open={Boolean(viewMeeting)}
                title={viewMeeting ? `Meeting Content: ${viewMeeting.title}` : "Meeting Content"}
                onCancel={() => setViewMeeting(null)}
                footer={
                    <Button onClick={() => setViewMeeting(null)}>
                        Close
                    </Button>
                }
                width={900}
            >
                {viewMeeting && (
                    <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
                        {viewMeeting.manualTranscript && (
                            <Card size="small" type="inner" title="Manual Transcript">
                                <Typography.Paragraph style={{ marginBottom: 0, whiteSpace: "pre-wrap" }}>
                                    {viewMeeting.manualTranscript}
                                </Typography.Paragraph>
                            </Card>
                        )}

                        <Card size="small" type="inner" title="Meeting Summary">
                            <Space orientation="vertical" size="small" style={{ width: "100%" }}>
                                <TextArea
                                    value={meetingSummaryDraft}
                                    onChange={(e) => setMeetingSummaryDraft(e.target.value)}
                                    rows={5}
                                    placeholder="Generate with AI or write a summary manually"
                                />
                                <Flex justify="space-between" align="center" wrap="wrap" gap={8}>
                                    <Button
                                        onClick={handleGenerateMeetingSummary}
                                        loading={generateSummaryMutation.isPending}
                                    >
                                        {viewMeeting.summary ? "Regenerate with AI" : "Generate with AI"}
                                    </Button>
                                    {meetingSummaryDraft.trim().length > 0 &&
                                        meetingSummaryDraft.trim() !== (viewMeeting.summary ?? "").trim() && (
                                            <Button
                                                type="primary"
                                                onClick={handleSaveMeetingSummary}
                                                loading={updateMeetingSummaryMutation.isPending}
                                            >
                                                Save Summary
                                            </Button>
                                        )}
                                </Flex>

                                <Typography.Text strong>Meeting Analysis</Typography.Text>
                                <TextArea
                                    value={meetingAnalysisDraft}
                                    onChange={(e) => setMeetingAnalysisDraft(e.target.value)}
                                    rows={6}
                                    placeholder="Generate AI analysis using proposal context, stakeholders, and meeting summary"
                                />
                                <Flex justify="space-between" align="center" wrap="wrap" gap={8}>
                                    <Button
                                        onClick={handleGenerateMeetingAnalysis}
                                        loading={generateMeetingAnalysisMutation.isPending}
                                    >
                                        {viewMeeting.meetingAnalysis ? "Regenerate Analysis with AI" : "Generate Analysis with AI"}
                                    </Button>
                                    {meetingAnalysisDraft.trim().length > 0 &&
                                        meetingAnalysisDraft.trim() !== (viewMeeting.meetingAnalysis ?? "").trim() && (
                                            <Button
                                                type="primary"
                                                onClick={handleSaveMeetingAnalysis}
                                                loading={updateMeetingAnalysisMutation.isPending}
                                            >
                                                Save Analysis
                                            </Button>
                                        )}
                                </Flex>
                            </Space>
                        </Card>

                        <Collapse
                            size="small"
                            items={[
                                {
                                    key: "speakers",
                                    label: `Speakers (${viewMeeting.speakers?.length ?? 0})`,
                                    children:
                                        viewMeeting.speakers && viewMeeting.speakers.length > 0 ? (
                                            <Space orientation="vertical" size="small" style={{ width: "100%" }}>
                                                {viewMeeting.speakers
                                                    .slice()
                                                    .sort((a, b) => a.speakerId - b.speakerId)
                                                    .map((speaker) => {
                                                        const draft = speakerDrafts[speaker.id];
                                                        const labelValue = draft?.speakerLabel ?? speaker.speakerLabel;
                                                        const selectedPersonaId = draft?.personaId ?? speaker.linkedStakeholder?.id ?? null;
                                                        const hasRenameChanges =
                                                            labelValue.trim().length > 0 &&
                                                            labelValue.trim() !== speaker.speakerLabel.trim();
                                                        const hasAssignChanges =
                                                            selectedPersonaId !== null &&
                                                            selectedPersonaId !== (speaker.linkedStakeholder?.id ?? null);

                                                        return (
                                                            <Card key={speaker.id} size="small" style={{ borderRadius: 10 }}>
                                                                <Flex justify="space-between" align="center" wrap="wrap" gap={8}>
                                                                    <Space size={8} wrap>
                                                                        <Tag>Speaker {speaker.speakerId}</Tag>
                                                                        <Typography.Text strong>
                                                                            {speaker.speakerLabel}
                                                                        </Typography.Text>
                                                                    </Space>
                                                                    {speaker.linkedStakeholder ? (
                                                                        <Tag color="green">{speaker.linkedStakeholder.fullName}</Tag>
                                                                    ) : (
                                                                        <Tag color="default">Not linked</Tag>
                                                                    )}
                                                                </Flex>

                                                                <Flex gap={8} wrap style={{ marginTop: 12 }}>
                                                                    <Space.Compact style={{ flex: 1, minWidth: 260 }}>
                                                                        <Input
                                                                            value={labelValue}
                                                                            onChange={(e) => {
                                                                                const nextValue = e.target.value;
                                                                                setSpeakerDrafts((prev) => ({
                                                                                    ...prev,
                                                                                    [speaker.id]: {
                                                                                        speakerLabel: nextValue,
                                                                                        personaId: prev[speaker.id]?.personaId ?? speaker.linkedStakeholder?.id ?? null,
                                                                                    },
                                                                                }));
                                                                            }}
                                                                            placeholder="Rename speaker"
                                                                        />
                                                                        {hasRenameChanges && (
                                                                            <Button
                                                                                type="primary"
                                                                                onClick={() => handleRenameSpeaker(speaker)}
                                                                                loading={renameSpeakerMutation.isPending}
                                                                            >
                                                                                Save
                                                                            </Button>
                                                                        )}
                                                                    </Space.Compact>

                                                                    <Space.Compact style={{ flex: 1, minWidth: 280 }}>
                                                                        <Select
                                                                            style={{ width: "100%" }}
                                                                            placeholder="Assign stakeholder"
                                                                            options={proposal.stakeholders.map((stakeholder) => ({
                                                                                label: stakeholder.persona.fullName,
                                                                                value: stakeholder.personaId,
                                                                            }))}
                                                                            value={selectedPersonaId ?? undefined}
                                                                            onChange={(value) => {
                                                                                setSpeakerDrafts((prev) => ({
                                                                                    ...prev,
                                                                                    [speaker.id]: {
                                                                                        speakerLabel: prev[speaker.id]?.speakerLabel ?? speaker.speakerLabel,
                                                                                        personaId: value,
                                                                                    },
                                                                                }));
                                                                            }}
                                                                        />
                                                                        {hasAssignChanges && (
                                                                            <Button
                                                                                type="primary"
                                                                                onClick={() => handleAssignSpeaker(speaker)}
                                                                                loading={linkSpeakerMutation.isPending}
                                                                            >
                                                                                Assign
                                                                            </Button>
                                                                        )}
                                                                    </Space.Compact>
                                                                </Flex>
                                                            </Card>
                                                        );
                                                    })}
                                            </Space>
                                        ) : (
                                            <Typography.Text type="secondary">No speaker mapping found for this note.</Typography.Text>
                                        ),
                                },
                            ]}
                        />

                        <Collapse
                            size="small"
                            items={[
                                {
                                    key: "transcription-segments",
                                    label: `Transcription Segments (${viewMeeting.transcripts?.length ?? 0})`,
                                    children:
                                        viewMeeting.transcripts && viewMeeting.transcripts.length > 0 ? (
                                            <Table
                                                size="small"
                                                rowKey="id"
                                                pagination={false}
                                                columns={[
                                                    {
                                                        title: "Speaker",
                                                        key: "speaker",
                                                        dataIndex: "speakerLabel",
                                                        width: 160,
                                                    },
                                                    {
                                                        title: "Text",
                                                        key: "text",
                                                        render: (_: unknown, segment: any) => (
                                                            <Typography.Text style={{ whiteSpace: "pre-wrap" }}>
                                                                {segment.text}
                                                            </Typography.Text>
                                                        ),
                                                    },
                                                ]}
                                                dataSource={[...(viewMeeting.transcripts ?? [])].sort((a, b) => {
                                                    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                                                    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                                                    return aTime - bTime;
                                                })}
                                            />
                                        ) : (
                                            <Typography.Text type="secondary">No transcript segments found for this note.</Typography.Text>
                                        ),
                                },
                            ]}
                        />
                    </Space>
                )}
            </Modal>
        </div>
    );
}

