--
-- PostgreSQL database dump
--

\restrict GrEd6SP6agv4IPiOqBxHoJlfe0x0Jzj99ijib0qzfvldjCEiqgDFT4suvbQH1fK

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.9 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: activity_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.activity_type AS ENUM (
    'LOGIN',
    'LOGOUT',
    'DOCUMENT_CREATED',
    'DOCUMENT_UPDATED',
    'DOCUMENT_DELETED',
    'DOCUMENT_RESTORED',
    'DOCUMENT_SHARED',
    'DOCUMENT_ASSIGNED',
    'DOCUMENT_DOWNLOADED',
    'DOCUMENT_EXTRACTED',
    'DOCUMENT_PERMISSION_CHANGED',
    'DOCUMENT_VERSION_CREATED',
    'DOCUMENT_COMMENT_ADDED',
    'DOCUMENT_COMMENT_DELETED',
    'CONVENIO_CREATED',
    'CONVENIO_UPDATED',
    'CONVENIO_DELETED',
    'GROUP_CREATED',
    'GROUP_UPDATED',
    'GROUP_DELETED',
    'GROUP_MEMBER_ADDED',
    'GROUP_MEMBER_REMOVED',
    'ADMIN_ACCESS_GRANTED',
    'ADMIN_ACCESS_DENIED',
    'BACKUP_CREATED',
    'BACKUP_RESTORED',
    'USER_REGISTERED',
    'USER_UPDATED',
    'PASSWORD_CHANGED',
    'SETTINGS_CHANGED',
    'COLLABORATION_STARTED',
    'COLLABORATION_ENDED',
    'DOCUMENT_LOCKED',
    'DOCUMENT_UNLOCKED',
    'CASE_CREATED',
    'CASE_UPDATED',
    'CASE_DOCUMENT_LINKED',
    'CASE_DOCUMENT_UNLINKED',
    'CONVENIO_VERSION_CREATED',
    'CONVENIO_COMMENT_ADDED',
    'CONVENIO_COMMENT_DELETED',
    'DOCUMENT_VIEWED'
);


--
-- Name: backup_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.backup_status AS ENUM (
    'pending',
    'in_progress',
    'completed',
    'failed'
);


--
-- Name: collaboration_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.collaboration_status AS ENUM (
    'VISTO',
    'EDITADO',
    'COMENTADO',
    'REVISADO',
    'APROBADO',
    'PENDIENTE_REVISION',
    'RECHAZADO'
);


--
-- Name: convenio_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.convenio_status AS ENUM (
    'activo',
    'pendiente',
    'vencido',
    'expirado',
    'cancelado'
);


--
-- Name: document_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.document_type AS ENUM (
    'docx',
    'doc',
    'pdf',
    'xlsx',
    'xls',
    'txt',
    'rtf'
);


--
-- Name: file_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.file_status AS ENUM (
    'ACTIVO',
    'PENDIENTE',
    'INACTIVO'
);


--
-- Name: group_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.group_role AS ENUM (
    'admin',
    'editor',
    'viewer'
);


--
-- Name: permission_level; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.permission_level AS ENUM (
    'none',
    'download',
    'read',
    'write',
    'admin'
);


--
-- Name: sharing_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.sharing_status AS ENUM (
    'ENVIADO',
    'ASIGNADO'
);


--
-- Name: sync_entity_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.sync_entity_type AS ENUM (
    'document',
    'convenio',
    'group',
    'user',
    'comment'
);


--
-- Name: sync_operation; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.sync_operation AS ENUM (
    'create',
    'update',
    'delete'
);


--
-- Name: sync_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.sync_status AS ENUM (
    'pending',
    'syncing',
    'completed',
    'failed'
);


--
-- Name: user_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_role AS ENUM (
    'admin',
    'asistente'
);


--
-- Name: fn_cleanup_stale_presence(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_cleanup_stale_presence() RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
  cleaned_count INTEGER;
BEGIN
  UPDATE collaboration_presence
  SET is_active = FALSE, left_at = NOW()
  WHERE is_active = TRUE
    AND last_seen < NOW() - INTERVAL '2 minutes';
  GET DIAGNOSTICS cleaned_count = ROW_COUNT;

  -- Cerrar sesiones sin participantes activos
  UPDATE collaboration_sessions
  SET is_active = FALSE, ended_at = NOW()
  WHERE is_active = TRUE
    AND id NOT IN (
      SELECT session_id FROM collaboration_presence WHERE is_active = TRUE
    );

  RETURN cleaned_count;
END;
$$;


--
-- Name: fn_limit_document_versions(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_limit_document_versions() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  DELETE FROM document_versions
  WHERE document_id = NEW.document_id
    AND id NOT IN (
      SELECT id FROM document_versions
      WHERE document_id = NEW.document_id
      ORDER BY version DESC
      LIMIT 10
    );
  RETURN NEW;
END;
$$;


--
-- Name: fn_purge_trash(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_purge_trash() RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM documents
  WHERE is_deleted = TRUE
    AND deleted_at < NOW() - INTERVAL '30 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;


--
-- Name: fn_release_expired_locks(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_release_expired_locks() RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
  released_count INTEGER;
BEGIN
  UPDATE document_locks
  SET released_at = NOW()
  WHERE released_at IS NULL
    AND expires_at < NOW();
  GET DIAGNOSTICS released_count = ROW_COUNT;
  RETURN released_count;
END;
$$;


--
-- Name: fn_update_convenios_vencidos(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_update_convenios_vencidos() RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE convenios
  SET estado = 'vencido', updated_at = NOW()
  WHERE estado IN ('activo', 'pendiente')
    AND fecha_fin < CURRENT_DATE;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;


--
-- Name: fn_update_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_update_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: activity_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activity_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    activity public.activity_type NOT NULL,
    entity_type character varying(50),
    entity_id uuid,
    entity_name character varying(500),
    description text,
    metadata jsonb,
    ip_address inet,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: admin_access_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_access_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_id uuid NOT NULL,
    user_id uuid NOT NULL,
    granted boolean DEFAULT false NOT NULL,
    session_token character varying(255),
    ip_address inet,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: backups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.backups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(500) NOT NULL,
    type character varying(50) DEFAULT 'full'::character varying NOT NULL,
    status public.backup_status DEFAULT 'pending'::public.backup_status NOT NULL,
    file_path text,
    cloud_url text,
    size bigint,
    checksum character varying(128),
    documents_count integer DEFAULT 0,
    created_by uuid,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    error_message text,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    storage_key character varying(512),
    CONSTRAINT backups_type_check CHECK (((type)::text = ANY ((ARRAY['full'::character varying, 'incremental'::character varying, 'documents_only'::character varying, 'database_only'::character varying])::text[])))
);


--
-- Name: case_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.case_documents (
    case_id uuid NOT NULL,
    document_id uuid NOT NULL,
    added_at timestamp with time zone DEFAULT now() NOT NULL,
    added_by uuid
);


--
-- Name: cases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    case_number character varying(100) NOT NULL,
    title character varying(500) NOT NULL,
    client character varying(255),
    court character varying(255),
    case_type character varying(100),
    status character varying(50) DEFAULT 'en_proceso'::character varying NOT NULL,
    description text,
    start_date date,
    end_date date,
    responsible_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT cases_status_check CHECK (((status)::text = ANY ((ARRAY['en_proceso'::character varying, 'resuelto'::character varying, 'archivado'::character varying, 'apelacion'::character varying, 'pendiente'::character varying])::text[])))
);


--
-- Name: convenio_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.convenio_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    convenio_id uuid NOT NULL,
    user_id uuid NOT NULL,
    parent_id uuid,
    content text NOT NULL,
    is_resolved boolean DEFAULT false NOT NULL,
    is_deleted boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: convenio_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.convenio_documents (
    convenio_id uuid NOT NULL,
    document_id uuid NOT NULL,
    added_at timestamp with time zone DEFAULT now() NOT NULL,
    added_by uuid
);


--
-- Name: convenio_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.convenio_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    convenio_id uuid NOT NULL,
    version integer NOT NULL,
    snapshot_data jsonb NOT NULL,
    change_note text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: convenios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.convenios (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    numero character varying(100) NOT NULL,
    institucion character varying(255) NOT NULL,
    departamento character varying(255),
    descripcion text,
    fecha_inicio date NOT NULL,
    fecha_fin date NOT NULL,
    responsable_id uuid,
    estado public.convenio_status DEFAULT 'pendiente'::public.convenio_status NOT NULL,
    notas text,
    monto numeric(14,2),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    CONSTRAINT chk_fechas_convenio CHECK ((fecha_fin >= fecha_inicio))
);


--
-- Name: document_access_pins; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_access_pins (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_id uuid NOT NULL,
    pin character varying(6) NOT NULL,
    created_by uuid NOT NULL,
    used_by uuid,
    used_at timestamp with time zone,
    is_used boolean DEFAULT false NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: document_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_id uuid NOT NULL,
    assigned_to uuid NOT NULL,
    assigned_by uuid NOT NULL,
    status character varying(50) DEFAULT 'pendiente'::character varying NOT NULL,
    notes text,
    due_date date,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT document_assignments_status_check CHECK (((status)::text = ANY ((ARRAY['pendiente'::character varying, 'visto'::character varying, 'revisado'::character varying, 'completado'::character varying, 'rechazado'::character varying])::text[])))
);


--
-- Name: document_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_id uuid NOT NULL,
    user_id uuid NOT NULL,
    parent_id uuid,
    content text NOT NULL,
    page_number integer,
    position_x real,
    position_y real,
    is_resolved boolean DEFAULT false NOT NULL,
    is_deleted boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: document_pdfs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_pdfs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_id uuid NOT NULL,
    name character varying(500) NOT NULL,
    local_path text,
    size bigint DEFAULT 0 NOT NULL,
    source character varying(20) DEFAULT 'manual'::character varying NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    storage_key character varying(512),
    drive_file_id character varying(255)
);


--
-- Name: document_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_id uuid NOT NULL,
    user_id uuid,
    group_id uuid,
    permission_level public.permission_level DEFAULT 'read'::public.permission_level NOT NULL,
    granted_by uuid,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_permission_target CHECK (((user_id IS NOT NULL) OR (group_id IS NOT NULL)))
);


--
-- Name: document_sync_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_sync_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_id uuid NOT NULL,
    user_id uuid,
    operation public.sync_operation NOT NULL,
    status public.sync_status NOT NULL,
    drive_revision_id character varying(255),
    error_message text,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: document_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_id uuid NOT NULL,
    version integer NOT NULL,
    local_path text,
    cloud_url text,
    size bigint DEFAULT 0 NOT NULL,
    checksum character varying(128),
    change_note text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    storage_key character varying(512)
);


--
-- Name: documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(500) NOT NULL,
    type public.document_type NOT NULL,
    size bigint DEFAULT 0 NOT NULL,
    local_path text,
    cloud_url text,
    owner_id uuid,
    group_id uuid,
    case_id uuid,
    file_status public.file_status DEFAULT 'ACTIVO'::public.file_status NOT NULL,
    collaboration_status public.collaboration_status,
    sharing_status public.sharing_status,
    version integer DEFAULT 1 NOT NULL,
    checksum character varying(128),
    expiration_date date,
    is_deleted boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    description text,
    tags text[],
    mime_type character varying(255),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    drive_file_id character varying(255),
    drive_revision_id character varying(255),
    last_sync_at timestamp with time zone,
    sync_status public.sync_status DEFAULT 'pending'::public.sync_status NOT NULL,
    storage_key character varying(512)
);


--
-- Name: group_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.group_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role public.group_role DEFAULT 'viewer'::public.group_role NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    invite_code character varying(64),
    owner_id uuid NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title character varying(500) NOT NULL,
    message text NOT NULL,
    type character varying(50) DEFAULT 'info'::character varying NOT NULL,
    entity_type character varying(50),
    entity_id uuid,
    is_read boolean DEFAULT false NOT NULL,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT notifications_type_check CHECK (((type)::text = ANY ((ARRAY['info'::character varying, 'warning'::character varying, 'error'::character varying, 'success'::character varying, 'assignment'::character varying, 'share'::character varying, 'expiration'::character varying])::text[])))
);


--
-- Name: sync_queue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sync_queue (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entity_type public.sync_entity_type NOT NULL,
    entity_id uuid NOT NULL,
    operation public.sync_operation NOT NULL,
    payload jsonb,
    status public.sync_status DEFAULT 'pending'::public.sync_status NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    max_attempts integer DEFAULT 5 NOT NULL,
    last_error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    synced_at timestamp with time zone
);


--
-- Name: user_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    session_token character varying(512) NOT NULL,
    device_info jsonb,
    ip_address inet,
    is_active boolean DEFAULT true NOT NULL,
    last_activity timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    theme character varying(20) DEFAULT 'light'::character varying NOT NULL,
    font_size integer DEFAULT 16 NOT NULL,
    notifications boolean DEFAULT true NOT NULL,
    auto_save boolean DEFAULT true NOT NULL,
    auto_save_interval integer DEFAULT 30 NOT NULL,
    language character varying(10) DEFAULT 'es'::character varying NOT NULL,
    storage_path text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_settings_font_size_check CHECK (((font_size >= 12) AND (font_size <= 32))),
    CONSTRAINT user_settings_theme_check CHECK (((theme)::text = ANY ((ARRAY['light'::character varying, 'dark'::character varying, 'high_contrast'::character varying])::text[])))
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    password_hash character varying(255),
    role public.user_role DEFAULT 'asistente'::public.user_role NOT NULL,
    avatar_url text,
    phone character varying(50),
    office_name character varying(255),
    department character varying(255),
    "position" character varying(255),
    admin_pin_hash character varying(255),
    is_active boolean DEFAULT true NOT NULL,
    last_login timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: v_assigned_documents; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_assigned_documents WITH (security_invoker='on') AS
 SELECT da.id AS assignment_id,
    da.status AS assignment_status,
    da.notes AS assignment_notes,
    da.due_date,
    da.created_at AS assigned_at,
    d.id AS document_id,
    d.name AS document_name,
    d.type AS document_type,
    d.file_status,
    d.collaboration_status,
    d.expiration_date,
    d.updated_at AS last_modified,
    assigner.name AS assigned_by_name,
    assignee.name AS assigned_to_name,
    da.assigned_to,
    da.assigned_by
   FROM (((public.document_assignments da
     JOIN public.documents d ON ((da.document_id = d.id)))
     JOIN public.users assigner ON ((da.assigned_by = assigner.id)))
     JOIN public.users assignee ON ((da.assigned_to = assignee.id)))
  WHERE (d.is_deleted = false);


--
-- Name: v_case_details; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_case_details WITH (security_invoker='on') AS
 SELECT c.id AS case_id,
    c.case_number,
    c.title,
    c.client,
    c.court,
    c.case_type,
    c.status,
    c.description,
    c.start_date,
    c.end_date,
    c.created_at,
    u.name AS responsible_name,
    ( SELECT count(*) AS count
           FROM public.case_documents cd
          WHERE (cd.case_id = c.id)) AS total_documents
   FROM (public.cases c
     LEFT JOIN public.users u ON ((c.responsible_id = u.id)));


--
-- Name: v_convenios_dashboard; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_convenios_dashboard WITH (security_invoker='on') AS
 SELECT c.id,
    c.numero,
    c.institucion,
    c.departamento,
    c.descripcion,
    c.fecha_inicio,
    c.fecha_fin,
    c.responsable_id,
    c.estado,
    c.notas,
    c.monto,
    c.created_at,
    c.updated_at,
    u.name AS responsable_name,
        CASE
            WHEN (c.fecha_fin < CURRENT_DATE) THEN 'vencido'::text
            WHEN (c.fecha_fin <= (CURRENT_DATE + '30 days'::interval)) THEN 'por_vencer'::text
            ELSE (c.estado)::text
        END AS estado_display,
    (c.fecha_fin - CURRENT_DATE) AS dias_restantes,
    ( SELECT count(*) AS count
           FROM public.convenio_documents cd
          WHERE (cd.convenio_id = c.id)) AS total_documentos
   FROM (public.convenios c
     LEFT JOIN public.users u ON ((c.responsable_id = u.id)));


--
-- Name: v_documents_with_permissions; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_documents_with_permissions WITH (security_invoker='on') AS
 SELECT d.id,
    d.name,
    d.type,
    d.size,
    d.local_path,
    d.cloud_url,
    d.owner_id,
    d.group_id,
    d.case_id,
    d.file_status,
    d.collaboration_status,
    d.sharing_status,
    d.version,
    d.checksum,
    d.expiration_date,
    d.is_deleted,
    d.deleted_at,
    d.deleted_by,
    d.description,
    d.tags,
    d.mime_type,
    d.created_at,
    d.updated_at,
    dp.permission_level AS current_user_permission,
    dp.user_id AS permission_user_id,
    u.name AS owner_name
   FROM ((public.documents d
     LEFT JOIN public.document_permissions dp ON ((d.id = dp.document_id)))
     LEFT JOIN public.users u ON ((d.owner_id = u.id)))
  WHERE (d.is_deleted = false);


--
-- Name: v_recent_activity; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_recent_activity WITH (security_invoker='on') AS
 SELECT al.id,
    al.activity,
    al.entity_type,
    al.entity_id,
    al.entity_name,
    al.description,
    al.created_at,
    u.name AS user_name,
    u.email AS user_email,
    u.role AS user_role
   FROM (public.activity_log al
     LEFT JOIN public.users u ON ((al.user_id = u.id)))
  ORDER BY al.created_at DESC;


--
-- Name: activity_log activity_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_log
    ADD CONSTRAINT activity_log_pkey PRIMARY KEY (id);


--
-- Name: admin_access_log admin_access_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_access_log
    ADD CONSTRAINT admin_access_log_pkey PRIMARY KEY (id);


--
-- Name: backups backups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.backups
    ADD CONSTRAINT backups_pkey PRIMARY KEY (id);


--
-- Name: case_documents case_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_documents
    ADD CONSTRAINT case_documents_pkey PRIMARY KEY (case_id, document_id);


--
-- Name: cases cases_case_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cases
    ADD CONSTRAINT cases_case_number_key UNIQUE (case_number);


--
-- Name: cases cases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cases
    ADD CONSTRAINT cases_pkey PRIMARY KEY (id);


--
-- Name: convenio_comments convenio_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.convenio_comments
    ADD CONSTRAINT convenio_comments_pkey PRIMARY KEY (id);


--
-- Name: convenio_documents convenio_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.convenio_documents
    ADD CONSTRAINT convenio_documents_pkey PRIMARY KEY (convenio_id, document_id);


--
-- Name: convenio_versions convenio_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.convenio_versions
    ADD CONSTRAINT convenio_versions_pkey PRIMARY KEY (id);


--
-- Name: convenios convenios_numero_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.convenios
    ADD CONSTRAINT convenios_numero_key UNIQUE (numero);


--
-- Name: convenios convenios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.convenios
    ADD CONSTRAINT convenios_pkey PRIMARY KEY (id);


--
-- Name: document_access_pins document_access_pins_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_access_pins
    ADD CONSTRAINT document_access_pins_pkey PRIMARY KEY (id);


--
-- Name: document_assignments document_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_assignments
    ADD CONSTRAINT document_assignments_pkey PRIMARY KEY (id);


--
-- Name: document_comments document_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_comments
    ADD CONSTRAINT document_comments_pkey PRIMARY KEY (id);


--
-- Name: document_pdfs document_pdfs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_pdfs
    ADD CONSTRAINT document_pdfs_pkey PRIMARY KEY (id);


--
-- Name: document_permissions document_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_permissions
    ADD CONSTRAINT document_permissions_pkey PRIMARY KEY (id);


--
-- Name: document_sync_log document_sync_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_sync_log
    ADD CONSTRAINT document_sync_log_pkey PRIMARY KEY (id);


--
-- Name: document_versions document_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_versions
    ADD CONSTRAINT document_versions_pkey PRIMARY KEY (id);


--
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);


--
-- Name: group_members group_members_group_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_members
    ADD CONSTRAINT group_members_group_id_user_id_key UNIQUE (group_id, user_id);


--
-- Name: group_members group_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_members
    ADD CONSTRAINT group_members_pkey PRIMARY KEY (id);


--
-- Name: groups groups_invite_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.groups
    ADD CONSTRAINT groups_invite_code_key UNIQUE (invite_code);


--
-- Name: groups groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.groups
    ADD CONSTRAINT groups_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: sync_queue sync_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sync_queue
    ADD CONSTRAINT sync_queue_pkey PRIMARY KEY (id);


--
-- Name: document_assignments uq_doc_assignment; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_assignments
    ADD CONSTRAINT uq_doc_assignment UNIQUE (document_id, assigned_to);


--
-- Name: document_permissions uq_doc_group_perm; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_permissions
    ADD CONSTRAINT uq_doc_group_perm UNIQUE (document_id, group_id);


--
-- Name: document_permissions uq_doc_user_perm; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_permissions
    ADD CONSTRAINT uq_doc_user_perm UNIQUE (document_id, user_id);


--
-- Name: document_versions uq_doc_version; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_versions
    ADD CONSTRAINT uq_doc_version UNIQUE (document_id, version);


--
-- Name: user_sessions user_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_pkey PRIMARY KEY (id);


--
-- Name: user_sessions user_sessions_session_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_session_token_key UNIQUE (session_token);


--
-- Name: user_settings user_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT user_settings_pkey PRIMARY KEY (id);


--
-- Name: user_settings user_settings_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT user_settings_user_id_key UNIQUE (user_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: activity_log_activity_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX activity_log_activity_idx ON public.activity_log USING btree (activity);


--
-- Name: activity_log_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX activity_log_created_at_idx ON public.activity_log USING btree (created_at DESC);


--
-- Name: activity_log_entity_type_entity_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX activity_log_entity_type_entity_id_idx ON public.activity_log USING btree (entity_type, entity_id);


--
-- Name: activity_log_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX activity_log_user_id_idx ON public.activity_log USING btree (user_id);


--
-- Name: admin_access_log_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX admin_access_log_created_at_idx ON public.admin_access_log USING btree (created_at DESC);


--
-- Name: admin_access_log_document_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX admin_access_log_document_id_idx ON public.admin_access_log USING btree (document_id);


--
-- Name: admin_access_log_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX admin_access_log_user_id_idx ON public.admin_access_log USING btree (user_id);


--
-- Name: backups_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX backups_created_at_idx ON public.backups USING btree (created_at DESC);


--
-- Name: backups_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX backups_status_idx ON public.backups USING btree (status);


--
-- Name: case_documents_case_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX case_documents_case_id_idx ON public.case_documents USING btree (case_id);


--
-- Name: case_documents_document_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX case_documents_document_id_idx ON public.case_documents USING btree (document_id);


--
-- Name: cases_case_number_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cases_case_number_idx ON public.cases USING btree (case_number);


--
-- Name: cases_case_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cases_case_type_idx ON public.cases USING btree (case_type);


--
-- Name: cases_responsible_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cases_responsible_id_idx ON public.cases USING btree (responsible_id);


--
-- Name: cases_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cases_status_idx ON public.cases USING btree (status);


--
-- Name: convenio_comments_convenio_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX convenio_comments_convenio_id_idx ON public.convenio_comments USING btree (convenio_id);


--
-- Name: convenio_comments_parent_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX convenio_comments_parent_id_idx ON public.convenio_comments USING btree (parent_id);


--
-- Name: convenio_comments_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX convenio_comments_user_id_idx ON public.convenio_comments USING btree (user_id);


--
-- Name: convenio_versions_convenio_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX convenio_versions_convenio_id_idx ON public.convenio_versions USING btree (convenio_id);


--
-- Name: convenio_versions_created_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX convenio_versions_created_by_idx ON public.convenio_versions USING btree (created_by);


--
-- Name: convenios_estado_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX convenios_estado_idx ON public.convenios USING btree (estado);


--
-- Name: convenios_fecha_fin_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX convenios_fecha_fin_idx ON public.convenios USING btree (fecha_fin);


--
-- Name: convenios_institucion_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX convenios_institucion_idx ON public.convenios USING btree (institucion);


--
-- Name: convenios_responsable_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX convenios_responsable_id_idx ON public.convenios USING btree (responsable_id);


--
-- Name: document_access_pins_document_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_access_pins_document_id_idx ON public.document_access_pins USING btree (document_id);


--
-- Name: document_access_pins_pin_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_access_pins_pin_idx ON public.document_access_pins USING btree (pin);


--
-- Name: document_assignments_assigned_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_assignments_assigned_by_idx ON public.document_assignments USING btree (assigned_by);


--
-- Name: document_assignments_assigned_to_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_assignments_assigned_to_idx ON public.document_assignments USING btree (assigned_to);


--
-- Name: document_assignments_document_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_assignments_document_id_idx ON public.document_assignments USING btree (document_id);


--
-- Name: document_assignments_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_assignments_status_idx ON public.document_assignments USING btree (status);


--
-- Name: document_comments_document_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_comments_document_id_idx ON public.document_comments USING btree (document_id);


--
-- Name: document_comments_parent_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_comments_parent_id_idx ON public.document_comments USING btree (parent_id);


--
-- Name: document_comments_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_comments_user_id_idx ON public.document_comments USING btree (user_id);


--
-- Name: document_permissions_document_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_permissions_document_id_idx ON public.document_permissions USING btree (document_id);


--
-- Name: document_permissions_group_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_permissions_group_id_idx ON public.document_permissions USING btree (group_id);


--
-- Name: document_permissions_permission_level_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_permissions_permission_level_idx ON public.document_permissions USING btree (permission_level);


--
-- Name: document_permissions_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_permissions_user_id_idx ON public.document_permissions USING btree (user_id);


--
-- Name: document_sync_log_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_sync_log_created_at_idx ON public.document_sync_log USING btree (created_at DESC);


--
-- Name: document_sync_log_document_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_sync_log_document_id_idx ON public.document_sync_log USING btree (document_id);


--
-- Name: document_sync_log_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_sync_log_status_idx ON public.document_sync_log USING btree (status);


--
-- Name: document_versions_created_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_versions_created_by_idx ON public.document_versions USING btree (created_by);


--
-- Name: document_versions_document_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_versions_document_id_idx ON public.document_versions USING btree (document_id);


--
-- Name: documents_case_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX documents_case_id_idx ON public.documents USING btree (case_id);


--
-- Name: documents_collaboration_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX documents_collaboration_status_idx ON public.documents USING btree (collaboration_status);


--
-- Name: documents_file_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX documents_file_status_idx ON public.documents USING btree (file_status);


--
-- Name: documents_group_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX documents_group_id_idx ON public.documents USING btree (group_id);


--
-- Name: documents_is_deleted_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX documents_is_deleted_idx ON public.documents USING btree (is_deleted);


--
-- Name: documents_owner_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX documents_owner_id_idx ON public.documents USING btree (owner_id);


--
-- Name: documents_sharing_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX documents_sharing_status_idx ON public.documents USING btree (sharing_status);


--
-- Name: documents_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX documents_type_idx ON public.documents USING btree (type);


--
-- Name: documents_updated_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX documents_updated_at_idx ON public.documents USING btree (updated_at DESC);


--
-- Name: group_members_group_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX group_members_group_id_idx ON public.group_members USING btree (group_id);


--
-- Name: group_members_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX group_members_user_id_idx ON public.group_members USING btree (user_id);


--
-- Name: groups_owner_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX groups_owner_id_idx ON public.groups USING btree (owner_id);


--
-- Name: idx_document_pdfs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_pdfs_created_at ON public.document_pdfs USING btree (created_at DESC);


--
-- Name: idx_document_pdfs_document_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_pdfs_document_id ON public.document_pdfs USING btree (document_id);


--
-- Name: notifications_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notifications_created_at_idx ON public.notifications USING btree (created_at DESC);


--
-- Name: notifications_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notifications_type_idx ON public.notifications USING btree (type);


--
-- Name: notifications_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notifications_user_id_idx ON public.notifications USING btree (user_id);


--
-- Name: notifications_user_id_is_read_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notifications_user_id_is_read_idx ON public.notifications USING btree (user_id, is_read);


--
-- Name: sync_queue_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sync_queue_created_at_idx ON public.sync_queue USING btree (created_at);


--
-- Name: sync_queue_entity_type_entity_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sync_queue_entity_type_entity_id_idx ON public.sync_queue USING btree (entity_type, entity_id);


--
-- Name: sync_queue_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sync_queue_status_idx ON public.sync_queue USING btree (status);


--
-- Name: uq_convenio_version; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_convenio_version ON public.convenio_versions USING btree (convenio_id, version);


--
-- Name: user_sessions_is_active_expires_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_sessions_is_active_expires_at_idx ON public.user_sessions USING btree (is_active, expires_at);


--
-- Name: user_sessions_session_token_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_sessions_session_token_idx ON public.user_sessions USING btree (session_token);


--
-- Name: user_sessions_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_sessions_user_id_idx ON public.user_sessions USING btree (user_id);


--
-- Name: users_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_email_idx ON public.users USING btree (email);


--
-- Name: users_is_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_is_active_idx ON public.users USING btree (is_active);


--
-- Name: users_role_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_role_idx ON public.users USING btree (role);


--
-- Name: cases trg_cases_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cases_updated_at BEFORE UPDATE ON public.cases FOR EACH ROW EXECUTE FUNCTION public.fn_update_timestamp();


--
-- Name: convenios trg_convenios_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_convenios_updated_at BEFORE UPDATE ON public.convenios FOR EACH ROW EXECUTE FUNCTION public.fn_update_timestamp();


--
-- Name: document_assignments trg_doc_assignments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_doc_assignments_updated_at BEFORE UPDATE ON public.document_assignments FOR EACH ROW EXECUTE FUNCTION public.fn_update_timestamp();


--
-- Name: document_comments trg_doc_comments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_doc_comments_updated_at BEFORE UPDATE ON public.document_comments FOR EACH ROW EXECUTE FUNCTION public.fn_update_timestamp();


--
-- Name: document_permissions trg_doc_permissions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_doc_permissions_updated_at BEFORE UPDATE ON public.document_permissions FOR EACH ROW EXECUTE FUNCTION public.fn_update_timestamp();


--
-- Name: documents trg_documents_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_documents_updated_at BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.fn_update_timestamp();


--
-- Name: groups trg_groups_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_groups_updated_at BEFORE UPDATE ON public.groups FOR EACH ROW EXECUTE FUNCTION public.fn_update_timestamp();


--
-- Name: document_versions trg_limit_versions; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_limit_versions AFTER INSERT ON public.document_versions FOR EACH ROW EXECUTE FUNCTION public.fn_limit_document_versions();


--
-- Name: user_settings trg_user_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_user_settings_updated_at BEFORE UPDATE ON public.user_settings FOR EACH ROW EXECUTE FUNCTION public.fn_update_timestamp();


--
-- Name: users trg_users_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.fn_update_timestamp();


--
-- Name: activity_log activity_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_log
    ADD CONSTRAINT activity_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: admin_access_log admin_access_log_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_access_log
    ADD CONSTRAINT admin_access_log_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: admin_access_log admin_access_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_access_log
    ADD CONSTRAINT admin_access_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: backups backups_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.backups
    ADD CONSTRAINT backups_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: case_documents case_documents_added_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_documents
    ADD CONSTRAINT case_documents_added_by_fkey FOREIGN KEY (added_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: case_documents case_documents_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_documents
    ADD CONSTRAINT case_documents_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: case_documents case_documents_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_documents
    ADD CONSTRAINT case_documents_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: cases cases_responsible_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cases
    ADD CONSTRAINT cases_responsible_id_fkey FOREIGN KEY (responsible_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: convenio_comments convenio_comments_convenio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.convenio_comments
    ADD CONSTRAINT convenio_comments_convenio_id_fkey FOREIGN KEY (convenio_id) REFERENCES public.convenios(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: convenio_comments convenio_comments_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.convenio_comments
    ADD CONSTRAINT convenio_comments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.convenio_comments(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: convenio_comments convenio_comments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.convenio_comments
    ADD CONSTRAINT convenio_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: convenio_documents convenio_documents_added_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.convenio_documents
    ADD CONSTRAINT convenio_documents_added_by_fkey FOREIGN KEY (added_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: convenio_documents convenio_documents_convenio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.convenio_documents
    ADD CONSTRAINT convenio_documents_convenio_id_fkey FOREIGN KEY (convenio_id) REFERENCES public.convenios(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: convenio_documents convenio_documents_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.convenio_documents
    ADD CONSTRAINT convenio_documents_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: convenio_versions convenio_versions_convenio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.convenio_versions
    ADD CONSTRAINT convenio_versions_convenio_id_fkey FOREIGN KEY (convenio_id) REFERENCES public.convenios(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: convenio_versions convenio_versions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.convenio_versions
    ADD CONSTRAINT convenio_versions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: convenios convenios_responsable_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.convenios
    ADD CONSTRAINT convenios_responsable_id_fkey FOREIGN KEY (responsable_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: document_access_pins document_access_pins_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_access_pins
    ADD CONSTRAINT document_access_pins_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: document_access_pins document_access_pins_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_access_pins
    ADD CONSTRAINT document_access_pins_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: document_access_pins document_access_pins_used_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_access_pins
    ADD CONSTRAINT document_access_pins_used_by_fkey FOREIGN KEY (used_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: document_assignments document_assignments_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_assignments
    ADD CONSTRAINT document_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: document_assignments document_assignments_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_assignments
    ADD CONSTRAINT document_assignments_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: document_assignments document_assignments_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_assignments
    ADD CONSTRAINT document_assignments_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: document_comments document_comments_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_comments
    ADD CONSTRAINT document_comments_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: document_comments document_comments_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_comments
    ADD CONSTRAINT document_comments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.document_comments(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: document_comments document_comments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_comments
    ADD CONSTRAINT document_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: document_pdfs document_pdfs_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_pdfs
    ADD CONSTRAINT document_pdfs_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: document_pdfs document_pdfs_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_pdfs
    ADD CONSTRAINT document_pdfs_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;


--
-- Name: document_permissions document_permissions_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_permissions
    ADD CONSTRAINT document_permissions_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: document_permissions document_permissions_granted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_permissions
    ADD CONSTRAINT document_permissions_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: document_permissions document_permissions_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_permissions
    ADD CONSTRAINT document_permissions_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: document_permissions document_permissions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_permissions
    ADD CONSTRAINT document_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: document_sync_log document_sync_log_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_sync_log
    ADD CONSTRAINT document_sync_log_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: document_sync_log document_sync_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_sync_log
    ADD CONSTRAINT document_sync_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: document_versions document_versions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_versions
    ADD CONSTRAINT document_versions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: document_versions document_versions_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_versions
    ADD CONSTRAINT document_versions_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: documents documents_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: documents documents_deleted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: documents documents_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: documents documents_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: group_members group_members_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_members
    ADD CONSTRAINT group_members_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: group_members group_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_members
    ADD CONSTRAINT group_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: groups groups_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.groups
    ADD CONSTRAINT groups_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_sessions user_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_settings user_settings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT user_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: activity_log ALog: admins ven todo, usuarios ven propio; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "ALog: admins ven todo, usuarios ven propio" ON public.activity_log FOR SELECT USING (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::public.user_role))))));


--
-- Name: document_assignments Assignments: crear asignaciones; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Assignments: crear asignaciones" ON public.document_assignments FOR INSERT WITH CHECK ((assigned_by = auth.uid()));


--
-- Name: document_assignments Assignments: ver asignados al usuario; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Assignments: ver asignados al usuario" ON public.document_assignments FOR SELECT USING (((assigned_to = auth.uid()) OR (assigned_by = auth.uid())));


--
-- Name: backups Backups: solo admins; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Backups: solo admins" ON public.backups USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::public.user_role)))));


--
-- Name: case_documents CaseDocs: ver documentos de caso accesible; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "CaseDocs: ver documentos de caso accesible" ON public.case_documents FOR SELECT USING (((case_id IN ( SELECT cases.id
   FROM public.cases
  WHERE (cases.responsible_id = auth.uid()))) OR (EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::public.user_role))))));


--
-- Name: cases Cases: admins gestionan; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cases: admins gestionan" ON public.cases USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::public.user_role)))));


--
-- Name: cases Cases: admins ven todo; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cases: admins ven todo" ON public.cases FOR SELECT USING (((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::public.user_role)))) OR (responsible_id = auth.uid())));


--
-- Name: document_comments Comments: crear comentarios; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Comments: crear comentarios" ON public.document_comments FOR INSERT WITH CHECK ((user_id = auth.uid()));


--
-- Name: document_comments Comments: editar propios comentarios; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Comments: editar propios comentarios" ON public.document_comments FOR UPDATE USING ((user_id = auth.uid()));


--
-- Name: document_comments Comments: ver comentarios de documentos accesibles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Comments: ver comentarios de documentos accesibles" ON public.document_comments FOR SELECT USING ((document_id IN ( SELECT documents.id
   FROM public.documents
  WHERE (documents.owner_id = auth.uid())
UNION
 SELECT document_permissions.document_id
   FROM public.document_permissions
  WHERE ((document_permissions.user_id = auth.uid()) AND (document_permissions.permission_level <> 'none'::public.permission_level)))));


--
-- Name: convenios Convenios: admins gestionan; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Convenios: admins gestionan" ON public.convenios USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::public.user_role)))));


--
-- Name: convenios Convenios: admins ven todo; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Convenios: admins ven todo" ON public.convenios FOR SELECT USING (((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::public.user_role)))) OR (responsable_id = auth.uid())));


--
-- Name: document_pdfs DocPDFs: actualizar en documentos permitidos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "DocPDFs: actualizar en documentos permitidos" ON public.document_pdfs FOR UPDATE USING ((document_id IN ( SELECT documents.id
   FROM public.documents
  WHERE (documents.owner_id = auth.uid())
UNION
 SELECT document_permissions.document_id
   FROM public.document_permissions
  WHERE ((document_permissions.user_id = auth.uid()) AND (document_permissions.permission_level = ANY (ARRAY['write'::public.permission_level, 'admin'::public.permission_level]))))));


--
-- Name: document_pdfs DocPDFs: eliminar en documentos permitidos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "DocPDFs: eliminar en documentos permitidos" ON public.document_pdfs FOR DELETE USING ((document_id IN ( SELECT documents.id
   FROM public.documents
  WHERE (documents.owner_id = auth.uid())
UNION
 SELECT document_permissions.document_id
   FROM public.document_permissions
  WHERE ((document_permissions.user_id = auth.uid()) AND (document_permissions.permission_level = ANY (ARRAY['write'::public.permission_level, 'admin'::public.permission_level]))))));


--
-- Name: document_pdfs DocPDFs: insertar en documentos permitidos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "DocPDFs: insertar en documentos permitidos" ON public.document_pdfs FOR INSERT WITH CHECK ((((created_by IS NULL) OR (created_by = auth.uid())) AND (document_id IN ( SELECT documents.id
   FROM public.documents
  WHERE (documents.owner_id = auth.uid())
UNION
 SELECT document_permissions.document_id
   FROM public.document_permissions
  WHERE ((document_permissions.user_id = auth.uid()) AND (document_permissions.permission_level = ANY (ARRAY['write'::public.permission_level, 'admin'::public.permission_level])))))));


--
-- Name: document_pdfs DocPDFs: ver PDFs de documentos accesibles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "DocPDFs: ver PDFs de documentos accesibles" ON public.document_pdfs FOR SELECT USING ((document_id IN ( SELECT documents.id
   FROM public.documents
  WHERE (documents.owner_id = auth.uid())
UNION
 SELECT document_permissions.document_id
   FROM public.document_permissions
  WHERE ((document_permissions.user_id = auth.uid()) AND (document_permissions.permission_level <> 'none'::public.permission_level))
UNION
 SELECT d.id
   FROM public.documents d
  WHERE ((d.group_id IS NOT NULL) AND (d.group_id IN ( SELECT group_members.group_id
           FROM public.group_members
          WHERE (group_members.user_id = auth.uid())))))));


--
-- Name: document_permissions DocPerms: gestionar permisos de documentos propios; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "DocPerms: gestionar permisos de documentos propios" ON public.document_permissions USING ((document_id IN ( SELECT documents.id
   FROM public.documents
  WHERE (documents.owner_id = auth.uid()))));


--
-- Name: document_permissions DocPerms: ver permisos de documentos accesibles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "DocPerms: ver permisos de documentos accesibles" ON public.document_permissions FOR SELECT USING (((document_id IN ( SELECT documents.id
   FROM public.documents
  WHERE (documents.owner_id = auth.uid()))) OR (user_id = auth.uid())));


--
-- Name: documents Docs: actualizar por permiso write/admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Docs: actualizar por permiso write/admin" ON public.documents FOR UPDATE USING ((id IN ( SELECT document_permissions.document_id
   FROM public.document_permissions
  WHERE ((document_permissions.user_id = auth.uid()) AND (document_permissions.permission_level = ANY (ARRAY['write'::public.permission_level, 'admin'::public.permission_level]))))));


--
-- Name: documents Docs: actualizar propios; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Docs: actualizar propios" ON public.documents FOR UPDATE USING ((owner_id = auth.uid()));


--
-- Name: documents Docs: crear propios; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Docs: crear propios" ON public.documents FOR INSERT WITH CHECK ((owner_id = auth.uid()));


--
-- Name: documents Docs: eliminar propios; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Docs: eliminar propios" ON public.documents FOR DELETE USING ((owner_id = auth.uid()));


--
-- Name: documents Docs: ver por grupo; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Docs: ver por grupo" ON public.documents FOR SELECT USING ((group_id IN ( SELECT group_members.group_id
   FROM public.group_members
  WHERE (group_members.user_id = auth.uid()))));


--
-- Name: documents Docs: ver por permiso directo; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Docs: ver por permiso directo" ON public.documents FOR SELECT USING ((id IN ( SELECT document_permissions.document_id
   FROM public.document_permissions
  WHERE ((document_permissions.user_id = auth.uid()) AND (document_permissions.permission_level <> 'none'::public.permission_level)))));


--
-- Name: documents Docs: ver propios; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Docs: ver propios" ON public.documents FOR SELECT USING ((owner_id = auth.uid()));


--
-- Name: group_members GMembers: ver miembros de mis grupos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "GMembers: ver miembros de mis grupos" ON public.group_members FOR SELECT USING ((group_id IN ( SELECT group_members_1.group_id
   FROM public.group_members group_members_1
  WHERE (group_members_1.user_id = auth.uid()))));


--
-- Name: groups Groups: actualizar propios; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Groups: actualizar propios" ON public.groups FOR UPDATE USING ((owner_id = auth.uid()));


--
-- Name: groups Groups: crear; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Groups: crear" ON public.groups FOR INSERT WITH CHECK ((owner_id = auth.uid()));


--
-- Name: groups Groups: ver grupos del usuario; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Groups: ver grupos del usuario" ON public.groups FOR SELECT USING (((owner_id = auth.uid()) OR (id IN ( SELECT group_members.group_id
   FROM public.group_members
  WHERE (group_members.user_id = auth.uid())))));


--
-- Name: notifications Notif: actualizar propias (marcar leída); Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Notif: actualizar propias (marcar leída)" ON public.notifications FOR UPDATE USING ((user_id = auth.uid()));


--
-- Name: notifications Notif: ver propias; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Notif: ver propias" ON public.notifications FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: user_sessions Sessions: ver propias; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Sessions: ver propias" ON public.user_sessions FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: user_settings Settings: gestionar propias; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Settings: gestionar propias" ON public.user_settings USING ((user_id = auth.uid()));


--
-- Name: user_settings Settings: ver propias; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Settings: ver propias" ON public.user_settings FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: users Users: actualizar propio perfil; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users: actualizar propio perfil" ON public.users FOR UPDATE USING ((auth.uid() = id));


--
-- Name: users Users: ver otros usuarios (para compartir/asignar); Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users: ver otros usuarios (para compartir/asignar)" ON public.users FOR SELECT USING (true);


--
-- Name: users Users: ver propio perfil; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users: ver propio perfil" ON public.users FOR SELECT USING ((auth.uid() = id));


--
-- Name: activity_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

--
-- Name: admin_access_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admin_access_log ENABLE ROW LEVEL SECURITY;

--
-- Name: backups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.backups ENABLE ROW LEVEL SECURITY;

--
-- Name: case_documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.case_documents ENABLE ROW LEVEL SECURITY;

--
-- Name: cases; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;

--
-- Name: convenio_comments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.convenio_comments ENABLE ROW LEVEL SECURITY;

--
-- Name: convenio_documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.convenio_documents ENABLE ROW LEVEL SECURITY;

--
-- Name: convenio_versions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.convenio_versions ENABLE ROW LEVEL SECURITY;

--
-- Name: convenios; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.convenios ENABLE ROW LEVEL SECURITY;

--
-- Name: document_access_pins; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_access_pins ENABLE ROW LEVEL SECURITY;

--
-- Name: document_assignments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_assignments ENABLE ROW LEVEL SECURITY;

--
-- Name: document_comments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_comments ENABLE ROW LEVEL SECURITY;

--
-- Name: document_pdfs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_pdfs ENABLE ROW LEVEL SECURITY;

--
-- Name: document_permissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_permissions ENABLE ROW LEVEL SECURITY;

--
-- Name: document_sync_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_sync_log ENABLE ROW LEVEL SECURITY;

--
-- Name: document_versions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;

--
-- Name: documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

--
-- Name: group_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

--
-- Name: groups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: sync_queue; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sync_queue ENABLE ROW LEVEL SECURITY;

--
-- Name: user_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: user_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict GrEd6SP6agv4IPiOqBxHoJlfe0x0Jzj99ijib0qzfvldjCEiqgDFT4suvbQH1fK

